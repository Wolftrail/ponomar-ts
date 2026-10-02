// Diagnostic: for each of the top-missing hymn identities surfaced by
// `day-facts-reproducibility.ts`, tell us why `hymns-cycle.ts` classified it
// as `unstable` and what multi-key coverage looks like per vendored year.

import { DAY_FACTS_BY_ISO } from "../../src/engine/dayFacts.ts";
import type { Hymn } from "../../src/data/dayFacts.ts";
import { computeDayContext } from "../../src/engine/day.ts";

const TARGETS: ReadonlyArray<{ kind: "trop" | "kont"; titlePrefix: string; textPrefix: string }> = [
	{ kind: "trop", titlePrefix: "The Bright Resurrection of Christ", textPrefix: "Christ is risen" },
	{ kind: "kont", titlePrefix: "Kontakion, Tone VIII", textPrefix: "Though Thou didst descend" },
	{ kind: "trop", titlePrefix: "Exaposieilarion", textPrefix: "Having slept in the flesh" },
	{ kind: "kont", titlePrefix: "The First Week of Great Lent", textPrefix: "My soul, my soul" },
	{ kind: "trop", titlePrefix: "Forefeast of the Nativity", textPrefix: "Make ready, O Bethlehem" },
	{ kind: "trop", titlePrefix: "Forefeast of the Theophany", textPrefix: "Make ready, O Zebulon" },
	{ kind: "kont", titlePrefix: "", textPrefix: "No Kontakion is given in the Menaion" },
];

interface Occ { readonly year: number; readonly iso: string; readonly nday: number; readonly julianKey: string; readonly dow: number; readonly tone: number | null; readonly hymn: Hymn; }

function matches(h: Hymn, kind: "trop" | "kont", t: typeof TARGETS[number]): boolean {
	if (kind !== t.kind) return false;
	if (t.titlePrefix && !h.title.startsWith(t.titlePrefix)) return false;
	return h.text.startsWith(t.textPrefix);
}

const occsByTarget = new Map<number, Occ[]>();
for (let i = 0; i < TARGETS.length; i++) occsByTarget.set(i, []);

for (const [iso, facts] of DAY_FACTS_BY_ISO) {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	const ctx = computeDayContext({ year: y, month: m, day: d });
	const julianKey = `${String(ctx.julian.month).padStart(2, "0")}-${String(ctx.julian.day).padStart(2, "0")}`;
	for (const h of facts.troparia) {
		for (let i = 0; i < TARGETS.length; i++) {
			if (matches(h, "trop", TARGETS[i]!)) {
				occsByTarget.get(i)!.push({ year: y, iso, nday: ctx.nday, julianKey, dow: ctx.dow, tone: facts.tone, hymn: h });
			}
		}
	}
	for (const h of facts.kontakia) {
		for (let i = 0; i < TARGETS.length; i++) {
			if (matches(h, "kont", TARGETS[i]!)) {
				occsByTarget.get(i)!.push({ year: y, iso, nday: ctx.nday, julianKey, dow: ctx.dow, tone: facts.tone, hymn: h });
			}
		}
	}
}

for (let i = 0; i < TARGETS.length; i++) {
	const t = TARGETS[i]!;
	const occs = occsByTarget.get(i)!;
	console.log(`\n=== [${t.kind}] "${t.titlePrefix}" / "${t.textPrefix}" (${occs.length} occurrences) ===`);
	if (occs.length === 0) { console.log("  no occurrences"); continue; }

	const julianKeys = new Set(occs.map(o => o.julianKey));
	const ndays = new Set(occs.map(o => o.nday));
	const dows = new Set(occs.map(o => o.dow));
	const tones = new Set(occs.map(o => o.tone));
	console.log(`  distinct julianKeys: ${julianKeys.size} → ${[...julianKeys].sort().join(",")}`);
	console.log(`  distinct ndays:      ${ndays.size} → ${[...ndays].sort((a,b)=>a-b).join(",")}`);
	console.log(`  distinct dows:       ${dows.size} → ${[...dows].sort().join(",")}`);
	console.log(`  distinct tones:      ${tones.size} → ${[...tones].sort().join(",")}`);

	// Per-year per-nday / per-julianKey coverage check
	const byYearNday = new Map<number, Set<number>>();
	const byYearJulian = new Map<number, Set<string>>();
	for (const o of occs) {
		if (!byYearNday.has(o.year)) byYearNday.set(o.year, new Set());
		byYearNday.get(o.year)!.add(o.nday);
		if (!byYearJulian.has(o.year)) byYearJulian.set(o.year, new Set());
		byYearJulian.get(o.year)!.add(o.julianKey);
	}
	const perYearNday = [...byYearNday.entries()].map(([y, s]) => `${y}:{${[...s].sort((a,b)=>a-b).join(",")}}`).join(" | ");
	const perYearJul = [...byYearJulian.entries()].map(([y, s]) => `${y}:{${[...s].sort().join(",")}}`).join(" | ");
	console.log(`  per-year ndays:      ${perYearNday}`);
	console.log(`  per-year julianKeys: ${perYearJul}`);

	// Would multi-key per-nday work?
	const yearsSeen = [...byYearNday.keys()];
	const ndayAllYears = [...ndays].filter(n => yearsSeen.every(y => byYearNday.get(y)!.has(n)));
	const julianAllYears = [...julianKeys].filter(k => yearsSeen.every(y => byYearJulian.get(y)!.has(k)));
	console.log(`  ndays stable across all years:      ${ndayAllYears.length} → ${ndayAllYears.sort((a,b)=>a-b).join(",")}`);
	console.log(`  julianKeys stable across all years: ${julianAllYears.length} → ${julianAllYears.sort().join(",")}`);
}
