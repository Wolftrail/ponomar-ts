// Codegen: emits DOW-shift / DOW-nearest-Julian movable commemorations.
// Consumes the shared classifier in `classify.ts`.
//
// For each "dow-shift" entry, infers a `DowMovableRule` from the text's
// parenthetical ("( movable holiday on the Sunday closest to July 16 )")
// or from a known title pattern ("Saturday after the Nativity …").
// Entries whose rule can't be inferred print a warning and are skipped.
//
// Run:   node --experimental-strip-types scripts/codegen/dow-movables.ts
// Emits: src/data/dowMovables.ts

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { classifyAll } from "./classify.ts";
import type { Commemoration } from "../../src/data/dayFacts.ts";

const OUTPUT = resolve(process.cwd(), "src/data/dowMovables.ts");

// Target DOW: 0=Sun, 6=Sat.
const DOW: Record<string, number> = { sunday: 0, saturday: 6 };

const MONTHS: Record<string, number> = {
	january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
	july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

type Rule =
	| { kind: "dow-after"; dow: number; julianMonth: number; julianDay: number }
	| { kind: "dow-after-strict"; dow: number; julianMonth: number; julianDay: number }
	| { kind: "dow-before"; dow: number; julianMonth: number; julianDay: number }
	| { kind: "dow-before-strict"; dow: number; julianMonth: number; julianDay: number }
	| { kind: "dow-nearest"; dow: number; julianMonth: number; julianDay: number }
	| { kind: "dow-window"; dow: number; julianMonth: number; julianDay: number; minDiff: number; maxDiff: number }
	| { kind: "nday-set"; ndays: readonly number[] };

// Known title-only entries (no parenthetical). Keys are startsWith matches.
const TITLE_RULES: readonly { prefix: string; rule: Rule }[] = [
	// Nativity (Julian Dec 25).
	{ prefix: "Saturday the Nativity of our Lord God and Savior Jesus Christ", rule: { kind: "dow-before", dow: 6, julianMonth: 12, julianDay: 24 } },
	{ prefix: "Saturday after the Nativity of our Lord God and Savior Jesus Christ", rule: { kind: "dow-after-strict", dow: 6, julianMonth: 12, julianDay: 25 } },
	{ prefix: "Sunday before the Nativity of our Lord God and Savior Jesus Christ.", rule: { kind: "dow-before", dow: 0, julianMonth: 12, julianDay: 24 } },
	{ prefix: "Sunday after the Nativity of our Lord God and Savior Jesus Christ, holy ancestors.", rule: { kind: "dow-after-strict", dow: 0, julianMonth: 12, julianDay: 25 } },
	// Theophany / Baptism (Julian Jan 6).
	{ prefix: "Saturday before the Theophany.", rule: { kind: "dow-before-strict", dow: 6, julianMonth: 1, julianDay: 6 } },
	// Sunday before Baptism fires only on Jan 2-5 Julian (diff -4..-1 from Jan 6);
	// Sundays on Dec 26-31 Julian get "Sunday after Nativity, holy ancestors" instead.
	{ prefix: "Sunday before the Baptism of Our Lord and God and Saviour Jesus Christ", rule: { kind: "dow-window", dow: 0, julianMonth: 1, julianDay: 6, minDiff: -4, maxDiff: -1 } },
	{ prefix: "Saturday after the Baptism of Our Lord and God and Saviour Jesus Christ", rule: { kind: "dow-after-strict", dow: 6, julianMonth: 1, julianDay: 6 } },
	{ prefix: "Sunday after the Baptism of Our Lord and God and Saviour Jesus Christ", rule: { kind: "dow-after-strict", dow: 0, julianMonth: 1, julianDay: 6 } },
	// Universal Elevation of the Cross (Julian Sep 14).
	{ prefix: "Saturday before the Universal Elevation", rule: { kind: "dow-before-strict", dow: 6, julianMonth: 9, julianDay: 14 } },
	{ prefix: "Sunday before the Universal Elevation", rule: { kind: "dow-before-strict", dow: 0, julianMonth: 9, julianDay: 14 } },
	{ prefix: "Saturday after the Universal Elevation", rule: { kind: "dow-after-strict", dow: 6, julianMonth: 9, julianDay: 14 } },
	{ prefix: "Sunday after the Universal Elevation", rule: { kind: "dow-after-strict", dow: 0, julianMonth: 9, julianDay: 14 } },
	// Sunday of Holy Forefathers (last Sun on or before Julian Dec 17).
	{ prefix: "Week of Holy Forefathers", rule: { kind: "dow-before", dow: 0, julianMonth: 12, julianDay: 17 } },
	// Fathers of the Seventh Ecumenical Council: HTOC fires on the Sunday
	// nearest Julian Oct 11 (window Oct 8-14 Julian), not strictly after it.
	{ prefix: "Commemoration of the Holy Fathers of the Seventh Ecumenical Council", rule: { kind: "dow-nearest", dow: 0, julianMonth: 10, julianDay: 11 } },
	// Triodion Parents' Saturdays (2nd, 3rd, 4th Lenten Sats).
	{ prefix: "Parents\u2019 Saturday. Remembrance of the dead", rule: { kind: "nday-set", ndays: [-36, -29, -22] } },
	// Demetrius Saturday (last Sat strictly before Julian Oct 26).
	{ prefix: "Demetrius (Parental) Saturday", rule: { kind: "dow-before-strict", dow: 6, julianMonth: 10, julianDay: 26 } },
	// Remembrance of departed in persecution (same anchor as New Martyrs of Russian Church).
	{ prefix: "Remembrance of all the departed who suffered", rule: { kind: "dow-nearest", dow: 0, julianMonth: 1, julianDay: 25 } },
	// HTOC data anomaly: text says "Saturday" but the icon actually fires on
	// the Sunday on-or-after Julian June 18 across all vendored years.
	{ prefix: "Korobeinikov-Kazan Icon of the Most Holy Theotokos", rule: { kind: "dow-after", dow: 0, julianMonth: 6, julianDay: 18 } },
	// Spanish Icon's parenthetical says "Sunday before Sep 29" and HTOC
	// fires it on the Sunday on-or-before Julian Sep 29 (inclusive) — i.e.
	// the plain dow-before window diff ∈ [-6, 0], not dow-nearest.
	{ prefix: "Synaxis of All Saints Who Shone Forth in the Spanish and Portuguese Lands", rule: { kind: "dow-before", dow: 0, julianMonth: 9, julianDay: 29 } },
];

function parseParenthetical(text: string): Rule | null {
	// Normalize "Nth" suffixes and typo "after to".
	const normalized = text.replace(/\s+/g, " ").replace(/after to\b/gi, "after");
	// (… DOW {closest|nearest|after|before|1st … after} to? MONTH DAY (st|nd|rd|th)? …)
	const re = /\(\s*(?:movable holiday on|movable feast on|celebration on)\s+(?:the\s+)?(1st\s+)?(sunday|saturday)\s+(closest|nearest|after|before)\s+(?:to\s+)?([a-z]+)\s+(\d{1,2})\s*(?:st|nd|rd|th)?\b/i;
	const m = normalized.match(re);
	if (!m) return null;
	const nth = m[1] !== undefined;
	const dow = DOW[m[2]!.toLowerCase()];
	const rel = m[3]!.toLowerCase();
	const mon = MONTHS[m[4]!.toLowerCase()];
	const day = parseInt(m[5]!, 10);
	if (dow === undefined || mon === undefined) return null;
	switch (rel) {
		case "closest":
		case "nearest":
			return { kind: "dow-nearest", dow, julianMonth: mon, julianDay: day };
		case "after":
			// "1st Sunday after X" is strict (next Sunday); plain "Sunday after X"
			// is inclusive in HTOC (Sunday ON the anchor date counts).
			return nth
				? { kind: "dow-after-strict", dow, julianMonth: mon, julianDay: day }
				: { kind: "dow-after", dow, julianMonth: mon, julianDay: day };
		case "before":
			// "Sunday before X" is strict in HTOC (next earlier Sunday); the
			// anchor date itself does not count. Exceptions handled in TITLE_RULES.
			return { kind: "dow-before-strict", dow, julianMonth: mon, julianDay: day };
	}
	return null;
}

function inferRule(c: Commemoration): Rule | null {
	for (const { prefix, rule } of TITLE_RULES) {
		if (c.text.startsWith(prefix)) return rule;
	}
	// Parenthetical-anchored forms that reference a named feast rather than
	// a month-day; map these directly before parsing month-day parentheticals.
	if (/\(\s*movable holiday on the Saturday after the Baptism/i.test(c.text)) {
		return { kind: "dow-after-strict", dow: 6, julianMonth: 1, julianDay: 6 };
	}
	if (/\(\s*movable holiday on the Sunday after the Nativity/i.test(c.text)) {
		return { kind: "dow-after-strict", dow: 0, julianMonth: 12, julianDay: 25 };
	}
	return parseParenthetical(c.text);
}

interface Emitted {
	rule: Rule;
	rank: string;
	text: string;
	minor: boolean;
	lives: readonly { readonly name: string; readonly slug: string }[];
}

const emitted: Emitted[] = [];
const skipped: string[] = [];

// Group dow-shift occurrences by whitespace-normalized text key so that
// whitespace-only variants ("September 3rd" vs "September 3 rd") collapse
// to a single entry. The literal text we emit is the most frequent variant.
function normalizeText(s: string): string {
	return s
		.replace(/\s+/g, " ")
		// Collapse "3 rd"/"3 th" etc. to "3rd"/"3th" so ordinal-suffix
		// whitespace variants don't fragment groups.
		.replace(/(\d)\s+(st|nd|rd|th)\b/gi, "$1$2")
		.trim();
}

interface Group {
	livesKey: string;
	lives: readonly { readonly name: string; readonly slug: string }[];
	// (rank|minor|text) -> occurrence count, so we can pick the most common
	// literal variant across whitespace/rank drift between years.
	variantCounts: Map<string, { rank: string; minor: boolean; text: string; count: number }>;
}

const groups = new Map<string, Group>();
for (const o of classifyAll()) {
	if (o.classification !== "dow-shift") continue;
	const livesKey = o.commem.lives.map((l) => l.slug).join(",");
	const groupKey = `${normalizeText(o.commem.text)}|${livesKey}`;
	let g = groups.get(groupKey);
	if (!g) {
		g = {
			livesKey,
			lives: o.commem.lives.map((l) => ({ name: l.name, slug: l.slug })),
			variantCounts: new Map(),
		};
		groups.set(groupKey, g);
	}
	const variantKey = `${o.commem.rank}|${o.commem.minor ? 1 : 0}|${o.commem.text}`;
	const existing = g.variantCounts.get(variantKey);
	if (existing) existing.count++;
	else g.variantCounts.set(variantKey, { rank: o.commem.rank, minor: o.commem.minor, text: o.commem.text, count: 1 });
}

for (const g of groups.values()) {
	// Pick the most-frequent (rank, minor, text) variant as the representative.
	let best: { rank: string; minor: boolean; text: string; count: number } | null = null;
	for (const v of g.variantCounts.values()) {
		if (!best || v.count > best.count) best = v;
	}
	if (!best) continue;
	const probe: Commemoration = {
		rank: best.rank,
		text: best.text,
		minor: best.minor,
		lives: g.lives,
	};
	const rule = inferRule(probe);
	if (!rule) {
		skipped.push(best.text);
		continue;
	}
	emitted.push({
		rule,
		rank: best.rank,
		text: best.text,
		minor: best.minor,
		lives: g.lives,
	});
}

// Deterministic sort for review-friendly diffs.
emitted.sort((a, b) => a.text.localeCompare(b.text));

const lines: string[] = [];
lines.push(`// AUTO-GENERATED by scripts/codegen/dow-movables.ts — do not edit by hand.`);
lines.push(`// Decomposed from DAY_FACTS_BY_ISO (2025-2030 vendored window).`);
lines.push(`// Generated: ${new Date().toISOString()}`);
lines.push(`// DOW-shift / DOW-nearest-Julian entries captured: ${emitted.length}`);
lines.push(`// Skipped (no rule inferred): ${skipped.length}`);
lines.push(``);
lines.push(`import type { Commemoration } from "./dayFacts.ts";`);
lines.push(``);
lines.push(`/** DOW-shift / DOW-nearest-Julian rule for a movable commemoration. */`);
lines.push(`export type DowMovableRule =`);
lines.push(`\t| { readonly kind: "dow-after"; readonly dow: number; readonly julianMonth: number; readonly julianDay: number }`);
lines.push(`\t| { readonly kind: "dow-after-strict"; readonly dow: number; readonly julianMonth: number; readonly julianDay: number }`);
lines.push(`\t| { readonly kind: "dow-before"; readonly dow: number; readonly julianMonth: number; readonly julianDay: number }`);
lines.push(`\t| { readonly kind: "dow-before-strict"; readonly dow: number; readonly julianMonth: number; readonly julianDay: number }`);
lines.push(`\t| { readonly kind: "dow-nearest"; readonly dow: number; readonly julianMonth: number; readonly julianDay: number }`);
lines.push(`\t| { readonly kind: "dow-window"; readonly dow: number; readonly julianMonth: number; readonly julianDay: number; readonly minDiff: number; readonly maxDiff: number }`);
lines.push(`\t| { readonly kind: "nday-set"; readonly ndays: readonly number[] };`);
lines.push(``);
lines.push(`/** One commemoration tagged with its DOW-shift rule. */`);
lines.push(`export interface DowMovable {`);
lines.push(`\treadonly rule: DowMovableRule;`);
lines.push(`\treadonly commem: Commemoration;`);
lines.push(`}`);
lines.push(``);
lines.push(`/** DOW-shift / DOW-nearest-Julian commemoration overlay. Each entry is`);
lines.push(` *  tested against the current DayContext at runtime by the matcher in`);
lines.push(` *  src/engine/commemorations.ts. */`);
lines.push(`export const DOW_MOVABLES: readonly DowMovable[] = [`);
for (const e of emitted) {
	const livesJson = JSON.stringify(e.lives);
	lines.push(`\t{`);
	lines.push(`\t\trule: ${JSON.stringify(e.rule)},`);
	lines.push(`\t\tcommem: { rank: ${JSON.stringify(e.rank)}, text: ${JSON.stringify(e.text)}, minor: ${e.minor}, lives: ${livesJson} },`);
	lines.push(`\t},`);
}
lines.push(`];`);
lines.push(``);
lines.push(`/** Total number of DOW-shift movable commemorations captured. */`);
lines.push(`export const DOW_MOVABLES_COUNT = ${emitted.length};`);
lines.push(``);

writeFileSync(OUTPUT, lines.join("\n"), "utf8");
console.log(`Wrote ${OUTPUT}`);
console.log(`  ${emitted.length} dow-shift entries captured`);
console.log(`  ${skipped.length} skipped (no rule inferred)`);
if (skipped.length) {
	console.log(`\nSkipped texts:`);
	for (const t of skipped) console.log(`  ${t.slice(0, 140)}`);
}
