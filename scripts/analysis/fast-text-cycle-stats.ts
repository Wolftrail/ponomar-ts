// Stability analysis for the HTOC fastText cycle pivot.
//
// For each vendored day, classify its fast F-index by cycle axis:
//   - fixed-Julian: same Julian MM-DD → same F-index across all 3 years
//   - paschal:     same nday            → same F-index across all 3 years
//   - sunday-tone: Sunday dow=0 with same octoechos tone (null-tone days
//                  are paschal-cycle special days)
//
// Reports how many days are cycle-stable so we can decide whether a
// data-driven pivot (parallel to the hymn cycle maps) is viable.

import { DAY_FACTS_BY_ISO } from "../../src/data/dayFacts.ts";
import { computeDayContext } from "../../src/engine/day.ts";

type Axis = "fixed-julian" | "paschal" | "sunday-tone" | "unstable";

interface DayRow {
	iso: string;
	fastText: string;
	nday: number;
	julianKey: string;
	dow: number;
	tone: number | null;
}

const rows: DayRow[] = [];
for (const [iso, facts] of DAY_FACTS_BY_ISO) {
	const [ys, ms, ds] = iso.split("-");
	const greg = { year: Number(ys), month: Number(ms), day: Number(ds) };
	const ctx = computeDayContext(greg);
	rows.push({
		iso,
		fastText: facts.fastText,
		nday: ctx.nday,
		julianKey: `${ctx.julian.month}-${ctx.julian.day}`,
		dow: ctx.dow,
		tone: facts.tone,
	});
}

// Group by each candidate axis-key, record the set of distinct fastTexts.
function groupStable<K>(key: (r: DayRow) => K): {
	stable: Map<K, string>;
	unstable: Map<K, Set<string>>;
} {
	const buckets = new Map<K, Set<string>>();
	const samples = new Map<K, string>();
	for (const r of rows) {
		const k = key(r);
		let s = buckets.get(k);
		if (!s) {
			s = new Set();
			buckets.set(k, s);
		}
		s.add(r.fastText);
		if (!samples.has(k)) samples.set(k, r.fastText);
	}
	const stable = new Map<K, string>();
	const unstable = new Map<K, Set<string>>();
	for (const [k, texts] of buckets) {
		if (texts.size === 1) stable.set(k, samples.get(k)!);
		else unstable.set(k, texts);
	}
	return { stable, unstable };
}

const byNday = groupStable((r) => r.nday);
const byJulian = groupStable((r) => r.julianKey);
const bySunTone = groupStable((r) =>
	r.dow === 0 && r.tone !== null ? `tone-${r.tone}` : null,
);
// Composite keys: (nday, dow) and (julianKey, dow) — HTOC's level within
// a major fast depends on both position and weekday.
const byNdayDow = groupStable((r) => `${r.nday}|${r.dow}`);
const byJulianDow = groupStable((r) => `${r.julianKey}|${r.dow}`);

// Decide per-day: which axis covers it? Precedence:
//   1. (nday, dow)        — paschal cycle with weekday variation
//   2. (julianKey, dow)   — fixed menaion with weekday variation
//   3. sunday-tone        — Sunday-only resurrectional
//   4. nday               — paschal cycle, dow-invariant
//   5. julianKey          — fixed menaion, dow-invariant
function classify(r: DayRow): Axis {
	if (byNdayDow.stable.has(`${r.nday}|${r.dow}`)) return "paschal";
	if (byJulianDow.stable.has(`${r.julianKey}|${r.dow}`)) return "fixed-julian";
	if (r.dow === 0 && r.tone !== null && bySunTone.stable.has(`tone-${r.tone}`)) {
		return "sunday-tone";
	}
	if (byNday.stable.has(r.nday)) return "paschal";
	if (byJulian.stable.has(r.julianKey)) return "fixed-julian";
	return "unstable";
}

const axisCount: Record<Axis, number> = {
	"fixed-julian": 0,
	paschal: 0,
	"sunday-tone": 0,
	unstable: 0,
};
const unstableRows: DayRow[] = [];
for (const r of rows) {
	const a = classify(r);
	axisCount[a]++;
	if (a === "unstable") unstableRows.push(r);
}

console.log(`=== HTOC fastText cycle-stability analysis ===`);
console.log(`Total days:                ${rows.length}`);
console.log(`Covered by paschal (nday): ${axisCount.paschal}`);
console.log(`Covered by sunday-tone:    ${axisCount["sunday-tone"]}`);
console.log(`Covered by fixed-Julian:   ${axisCount["fixed-julian"]}`);
console.log(`Unstable (fallback):       ${axisCount.unstable}`);
console.log(`Coverage: ${(((rows.length - axisCount.unstable) / rows.length) * 100).toFixed(2)}%`);

console.log(`\n=== Unstable Julian keys (showing variation) ===`);
const unstableJulian = new Map<string, Set<string>>();
for (const r of unstableRows) {
	let s = unstableJulian.get(r.julianKey);
	if (!s) {
		s = new Set();
		unstableJulian.set(r.julianKey, s);
	}
	s.add(`${r.iso}=${r.fastText}`);
}
for (const [k, examples] of [...unstableJulian].sort((a, b) => b[1].size - a[1].size).slice(0, 20)) {
	console.log(`  Julian ${k}  (${examples.size} variants):`);
	for (const e of examples) console.log(`    ${e}`);
}

console.log(`\n=== Unstable nday keys (sample) ===`);
const unstableNday = new Map<number, Set<string>>();
for (const r of unstableRows) {
	let s = unstableNday.get(r.nday);
	if (!s) {
		s = new Set();
		unstableNday.set(r.nday, s);
	}
	s.add(`${r.iso}=${r.fastText}`);
}
for (const [k, examples] of [...unstableNday].sort((a, b) => b[1].size - a[1].size).slice(0, 10)) {
	console.log(`  nday=${k}  (${examples.size} variants):`);
	for (const e of examples) console.log(`    ${e}`);
}
