// Codegen: emits the HTOC hymn (troparion + kontakion) cycle maps.
// Classifies every hymn-identity (unique title + text + saints tuple) in the
// vendored 2025-2030 corpus by position stability. A hymn-identity is
// reproducible under classification X when every occurrence of it falls on
// a key that is X-stable (present in every vendored year). Each hymn gets
// at most one classification but may be emitted under multiple keys within
// it — e.g. the Paschal troparion lives under paschal-movable at ndays
// {0..6}, "No Kontakion is given in the Menaion" under fixed-julian at
// 15 Julian keys.
//
//   fixed-julian:      reproducible via a stable set of Julian MM-DDs
//   paschal-movable:   reproducible via a stable set of `nday`s
//   sunday-tone:       Sunday-only occurrences, same resurrectional tone
//   dow-julian-window: moveable Sunday/Saturday propers that always land in
//                      a bounded Julian window around a fixed feast
//                      (e.g. Sunday Before Nativity, Sunday of the Holy
//                      Fathers of the 7th Ecumenical Council). Emits
//                      on observed (dow, julianKey) pairs only.
//   unstable:          skipped (DOW-shift beyond observed window; not
//                      reproducible from the vendored corpus)
//
// Mirror of `fixed-commemorations.ts` + `paschal-movables.ts` for hymns.
//
// Run:   node --experimental-strip-types scripts/codegen/hymns-cycle.ts
// Emits: src/data/hymnsCycle.ts

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { DAY_FACTS_BY_ISO } from "../../src/engine/dayFacts.ts";
import type { Hymn } from "../../src/data/dayFacts.ts";
import { computeDayContext } from "../../src/engine/day.ts";

const OUTPUT = resolve(process.cwd(), "src/data/hymnsCycle.ts");

type HymnKind = "trop" | "kont";

interface Occurrence {
	readonly julianKey: string;
	readonly nday: number;
	readonly dow: number;
	readonly tone: number | null;
	readonly year: number;
	readonly group: number;
	readonly kind: HymnKind;
	readonly hymn: Hymn;
}

function hymnIdentity(h: Hymn, kind: HymnKind): string {
	// Identity is (kind, title, text). Saint slugs are deliberately excluded:
	// the same hymn can appear with different saint-slug sets when its
	// commemoration coincides with another feast (e.g. 4th Sun of Lent hymn
	// in a year where it falls on the Julian fixed feast of St John Climacus
	// picks up both the paschal and the fixed saint tags). Those are the
	// SAME hymn to the reader. Merging them lets us measure cross-year
	// stability honestly.
	return `${kind}|${h.title}|${h.text}`;
}

const occurrences: Occurrence[] = [];
for (const [iso, facts] of DAY_FACTS_BY_ISO) {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	const ctx = computeDayContext({ year: y, month: m, day: d });
	const julianKey = `${String(ctx.julian.month).padStart(2, "0")}-${String(ctx.julian.day).padStart(2, "0")}`;
	for (const h of facts.troparia) {
		occurrences.push({ julianKey, nday: ctx.nday, dow: ctx.dow, tone: facts.tone, year: y, group: h.group, kind: "trop", hymn: h });
	}
	for (const h of facts.kontakia) {
		occurrences.push({ julianKey, nday: ctx.nday, dow: ctx.dow, tone: facts.tone, year: y, group: h.group, kind: "kont", hymn: h });
	}
}

const byIdentity = new Map<string, Occurrence[]>();
for (const o of occurrences) {
	const id = hymnIdentity(o.hymn, o.kind);
	if (!byIdentity.has(id)) byIdentity.set(id, []);
	byIdentity.get(id)!.push(o);
}

type Classification = "fixed-julian" | "paschal-movable" | "sunday-tone" | "dow-julian-window" | "unstable";

interface Bucket {
	readonly cls: Classification;
	readonly key: string;
	readonly group: number;
	readonly kind: HymnKind;
	readonly hymn: Hymn;
}

// A hymn identity is "reproducible under classification X" when every one of
// its occurrences falls on a key that is X-stable across every vendored year.
// Each hymn gets at most one classification, but may be emitted under multiple
// keys within it (e.g. Pascha troparion → paschal-movable at ndays {0..6}).
const allCorpusYears = [...new Set(occurrences.map((o) => o.year))].sort();
const buckets: Bucket[] = [];
let unstable = 0;
for (const [, group] of byIdentity) {
	const sample = group[0]!;

	const yearJulianKeys = new Map<number, Set<string>>();
	const yearNdays = new Map<number, Set<number>>();
	for (const o of group) {
		if (!yearJulianKeys.has(o.year)) yearJulianKeys.set(o.year, new Set());
		yearJulianKeys.get(o.year)!.add(o.julianKey);
		if (!yearNdays.has(o.year)) yearNdays.set(o.year, new Set());
		yearNdays.get(o.year)!.add(o.nday);
	}

	// Stability is measured against every corpus year, not just the years this
	// identity happens to appear in. If an identity is missing from any corpus
	// year, no key qualifies as stable → unstable (prevents single-year
	// composite identities from being locked to one specific julianKey or
	// nday, which would false-positive in other years).
	const stableJulianKeys = new Set(
		[...new Set(group.map((o) => o.julianKey))].filter((k) =>
			allCorpusYears.every((y) => yearJulianKeys.get(y)?.has(k) ?? false),
		),
	);
	const allJulianKeysCovered =
		stableJulianKeys.size > 0 && group.every((o) => stableJulianKeys.has(o.julianKey));

	const stableNdays = new Set(
		[...new Set(group.map((o) => o.nday))].filter((n) =>
			allCorpusYears.every((y) => yearNdays.get(y)?.has(n) ?? false),
		),
	);
	const allNdaysCovered =
		stableNdays.size > 0 && group.every((o) => stableNdays.has(o.nday));

	const tones = new Set(group.map((o) => o.tone));
	// Sunday-tone classification covers hymns that track the octoechos cycle
	// — the resurrectional troparia / kontakia that fire on every Sunday
	// with the given tone. These hymns fire multiple times per corpus year
	// (~6 Sundays per tone per year). Position-specific moveable propers
	// (Sunday Before Nativity, Holy Fathers, etc.) also happen to land on
	// one-tone Sundays in a given window but fire ≤1x per year. Require
	// at least ⌈1.5 × corpusYears⌉ occurrences so the latter falls through
	// to `dow-julian-window` where emission is restricted to observed keys.
	const sundayToneMinOccurrences = Math.ceil(1.5 * allCorpusYears.length);
	const sundayOneTone =
		group.length >= sundayToneMinOccurrences &&
		group.every((o) => o.dow === 0 && o.tone !== null) &&
		tones.size === 1;

	// A moveable Sunday/Saturday feast proper fires at most once per corpus
	// year and lands in a bounded julian window around the fixed feast it
	// anchors to. We emit on exactly the (dow, julianKey) pairs we have
	// observed — any civil year whose matching day falls on an observed
	// pair reproduces HTOC. Require >50% year coverage so single-year
	// composites don't lock a key. The DOW is NOT required to be unique:
	// some once-per-cycle hymns legitimately transfer across weekdays
	// (e.g. "Sunday After the Nativity" transfers to Monday when Nativity
	// itself falls on Sunday — in 2029 this hymn fires on Mon Jan 8).
	// Emission on observed pairs is the safety net against false positives.
	const yearsWithOccurrence = new Set(group.map((o) => o.year));
	const dowJulianMinYears = Math.ceil(allCorpusYears.length / 2);
	const dowJulianWindow = yearsWithOccurrence.size >= dowJulianMinYears;

	let cls: Classification;
	let keys: string[];
	if (allJulianKeysCovered) {
		cls = "fixed-julian";
		keys = [...stableJulianKeys].sort();
	} else if (allNdaysCovered) {
		cls = "paschal-movable";
		keys = [...stableNdays].sort((a, b) => a - b).map(String);
	} else if (sundayOneTone) {
		cls = "sunday-tone";
		keys = [String([...tones][0]!)];
	} else if (dowJulianWindow) {
		cls = "dow-julian-window";
		keys = [...new Set(group.map((o) => `${o.dow}-${o.julianKey}`))].sort();
	} else {
		unstable++;
		continue;
	}

	for (const key of keys) {
		buckets.push({ cls, key, group: sample.group, kind: sample.kind, hymn: sample.hymn });
	}
}

/** Group buckets by (classification, key), then emit per-classification maps. */
interface Slot {
	readonly troparia: Bucket[];
	readonly kontakia: Bucket[];
}
function emptySlot(): Slot {
	return { troparia: [], kontakia: [] };
}
const fixedByJulian = new Map<string, Slot>();
const paschalByNday = new Map<string, Slot>();
const sundayByTone = new Map<string, Slot>();
const dowJulianByKey = new Map<string, Slot>();

for (const b of buckets) {
	const map =
		b.cls === "fixed-julian" ? fixedByJulian
			: b.cls === "paschal-movable" ? paschalByNday
			: b.cls === "sunday-tone" ? sundayByTone
			: dowJulianByKey;
	if (!map.has(b.key)) map.set(b.key, emptySlot());
	const slot = map.get(b.key)!;
	(b.kind === "trop" ? slot.troparia : slot.kontakia).push(b);
}

function sortBuckets(a: Bucket, b: Bucket): number {
	if (a.group !== b.group) return a.group - b.group;
	return a.hymn.title.localeCompare(b.hymn.title);
}

function emitHymn(h: Hymn): string {
	const saints = h.saints.map((s) => `{ name: ${JSON.stringify(s.name)}, slug: ${JSON.stringify(s.slug)} }`).join(", ");
	return `{ title: ${JSON.stringify(h.title)}, text: ${JSON.stringify(h.text)}, group: ${h.group}, saints: [${saints}] }`;
}

function emitMap(name: string, docLine: string, map: ReadonlyMap<string, Slot>, keyIsNumber: boolean): string {
	const keys = [...map.keys()].sort((a, b) => keyIsNumber ? Number(a) - Number(b) : a.localeCompare(b));
	const lines: string[] = [];
	lines.push(docLine);
	lines.push(`export const ${name}: ReadonlyMap<${keyIsNumber ? "number" : "string"}, { readonly troparia: readonly Hymn[]; readonly kontakia: readonly Hymn[] }> = new Map([`);
	for (const k of keys) {
		const slot = map.get(k)!;
		const t = [...slot.troparia].sort(sortBuckets).map((b) => `\t\t${emitHymn(b.hymn)},`).join("\n");
		const kn = [...slot.kontakia].sort(sortBuckets).map((b) => `\t\t${emitHymn(b.hymn)},`).join("\n");
		const keyLit = keyIsNumber ? k : JSON.stringify(k);
		lines.push(`\t[${keyLit}, {`);
		lines.push(`\t\ttroparia: [`);
		if (t) lines.push(t);
		lines.push(`\t\t],`);
		lines.push(`\t\tkontakia: [`);
		if (kn) lines.push(kn);
		lines.push(`\t\t],`);
		lines.push(`\t}],`);
	}
	lines.push(`]);`);
	return lines.join("\n");
}

const fixedCount = [...fixedByJulian.values()].reduce((n, s) => n + s.troparia.length + s.kontakia.length, 0);
const paschalCount = [...paschalByNday.values()].reduce((n, s) => n + s.troparia.length + s.kontakia.length, 0);
const sundayCount = [...sundayByTone.values()].reduce((n, s) => n + s.troparia.length + s.kontakia.length, 0);
const dowJulianCount = [...dowJulianByKey.values()].reduce((n, s) => n + s.troparia.length + s.kontakia.length, 0);

const out: string[] = [];
out.push(`// AUTO-GENERATED by scripts/codegen/hymns-cycle.ts — do not edit by hand.`);
out.push(`// Decomposed from DAY_FACTS_BY_ISO (2025-2030 vendored window).`);
out.push(`// Generated: ${new Date().toISOString()}`);
out.push(`// Unique hymns classified: fixed-julian=${[...buckets].filter(b=>b.cls==='fixed-julian').length} paschal-movable=${[...buckets].filter(b=>b.cls==='paschal-movable').length} sunday-tone=${[...buckets].filter(b=>b.cls==='sunday-tone').length} dow-julian-window=${[...buckets].filter(b=>b.cls==='dow-julian-window').length} unstable=${unstable}`);
out.push(`// Emitted entries: fixed=${fixedCount} paschal=${paschalCount} sunday=${sundayCount} dowJulian=${dowJulianCount}`);
out.push(``);
out.push(`import type { Hymn } from "./dayFacts.ts";`);
out.push(``);
out.push(emitMap(
	"FIXED_HYMNS_CYCLE",
	`/** Fixed-Julian hymn cycle: keyed by Julian \`"MM-DD"\`. Covers hymns\n *  whose Julian anchor is stable across years (saint-specific propers,\n *  forefeast cycles, fixed Great Feasts). */`,
	fixedByJulian,
	false,
));
out.push(``);
out.push(emitMap(
	"PASCHAL_HYMNS_CYCLE",
	`/** Paschal-cycle hymn cycle: keyed by \`nday\` (days from Pascha).\n *  Covers hymns whose anchor shifts with the paschalion (Triodion,\n *  Pentecostarion, movable feasts). */`,
	paschalByNday,
	true,
));
out.push(``);
out.push(emitMap(
	"SUNDAY_TONE_HYMNS_CYCLE",
	`/** Sunday-tone hymn cycle: keyed by resurrectional tone (1..8). Covers\n *  the Octoechos resurrectional troparia and kontakia sung every Sunday\n *  of the week on that tone. */`,
	sundayByTone,
	true,
));
out.push(``);
out.push(emitMap(
	"DOW_JULIAN_WINDOW_HYMNS_CYCLE",
	`/** DOW+Julian-window hymn cycle: keyed by \`"\${dow}-MM-DD"\` where dow is\n *  0 (Sunday) ... 6 (Saturday). Covers moveable Sunday / Saturday propers\n *  tied to a fixed feast (e.g. Sunday Before Nativity, Sunday of the Holy\n *  Fathers of the 7th Ecumenical Council). Emits on the observed window\n *  only — civil years whose matching Sunday falls outside the window see\n *  no entry. */`,
	dowJulianByKey,
	false,
));
out.push(``);
out.push(`/** Total hymn entries in the four cycle maps. */`);
out.push(`export const HYMNS_CYCLE_COUNT = ${fixedCount + paschalCount + sundayCount + dowJulianCount};`);
out.push(``);

writeFileSync(OUTPUT, out.join("\n"), "utf8");
console.log(`Wrote ${OUTPUT}`);
console.log(`  fixed-julian:      ${fixedByJulian.size} keys, ${fixedCount} entries`);
console.log(`  paschal-movable:   ${paschalByNday.size} keys, ${paschalCount} entries`);
console.log(`  sunday-tone:       ${sundayByTone.size} keys, ${sundayCount} entries`);
console.log(`  dow-julian-window: ${dowJulianByKey.size} keys, ${dowJulianCount} entries`);
console.log(`  unstable skipped: ${unstable} unique hymns`);
