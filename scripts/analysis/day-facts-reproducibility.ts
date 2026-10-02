// Audit: for every day in `DAY_FACTS_BY_ISO`, compare each field against
// the algorithmic/cycle-based synthesizer and report per-field match rates.
// Order diffs count as "set match"; content diffs count as "mismatch".
//
// Goal: decide whether `DAY_FACTS_BY_ISO` can be replaced by on-the-fly
// cycle composition (plus a slim per-day exception overlay).

import { DAY_FACTS_BY_ISO } from "../../src/engine/dayFacts.ts";
import type { Commemoration, Hymn } from "../../src/data/dayFacts.ts";
import { computeDayContext } from "../../src/engine/day.ts";
import { renderHeaderText } from "../../src/engine/headerText.ts";
import { getOctoechosTone } from "../../src/engine/tone.ts";
import { getCommemorationsForAnyYear } from "../../src/engine/commemorations.ts";
import { getHymnsForAnyYear } from "../../src/engine/hymns.ts";
import { getLiturgicalDay } from "../../src/engine/index.ts";

interface FieldStats {
	exact: number;      // ordered + content match
	setOnly: number;    // same multiset, different order (sequences only)
	mismatch: number;   // content differs
	missingBy: Map<string, number>;
	extraBy: Map<string, number>;
}

function newStats(): FieldStats {
	return { exact: 0, setOnly: 0, mismatch: 0, missingBy: new Map(), extraBy: new Map() };
}

function tally(map: Map<string, number>, key: string): void {
	map.set(key, (map.get(key) ?? 0) + 1);
}

function commemKey(c: Commemoration): string {
	return `${c.rank}|${c.minor ? 1 : 0}|${c.text}`;
}
function hymnKey(h: Hymn): string {
	return `${h.title}||${h.text.slice(0, 80)}`;
}

function compareScalar<T>(
	stats: FieldStats,
	exp: T,
	got: T,
	fmt: (v: T) => string,
): void {
	if (exp === got) stats.exact++;
	else {
		stats.mismatch++;
		tally(stats.missingBy, fmt(exp));
		tally(stats.extraBy, fmt(got));
	}
}

function compareSeq<T>(
	stats: FieldStats,
	exp: readonly T[],
	got: readonly T[],
	keyOf: (v: T) => string,
): void {
	const expKeys = exp.map(keyOf);
	const gotKeys = got.map(keyOf);
	const sameOrder = expKeys.length === gotKeys.length
		&& expKeys.every((k, i) => k === gotKeys[i]);
	if (sameOrder) { stats.exact++; return; }
	const expSet = new Map<string, number>();
	for (const k of expKeys) expSet.set(k, (expSet.get(k) ?? 0) + 1);
	const gotSet = new Map<string, number>();
	for (const k of gotKeys) gotSet.set(k, (gotSet.get(k) ?? 0) + 1);
	let sameMultiset = expSet.size === gotSet.size;
	if (sameMultiset) {
		for (const [k, n] of expSet) if (gotSet.get(k) !== n) { sameMultiset = false; break; }
	}
	if (sameMultiset) { stats.setOnly++; return; }
	stats.mismatch++;
	for (const [k, n] of expSet) {
		const g = gotSet.get(k) ?? 0;
		if (g < n) tally(stats.missingBy, k);
	}
	for (const [k, n] of gotSet) {
		const e = expSet.get(k) ?? 0;
		if (e < n) tally(stats.extraBy, k);
	}
}

const fields = {
	headerText: newStats(),
	tone: newStats(),
	commemorations: newStats(),
	troparia: newStats(),
	kontakia: newStats(),
};

let total = 0;
let allPerfect = 0;

for (const [iso, facts] of DAY_FACTS_BY_ISO) {
	total++;
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	const greg = { year: y, month: m, day: d };
	const ctx = computeDayContext(greg);
	void getLiturgicalDay(greg);
	const tone = getOctoechosTone(ctx);
	const hymns = getHymnsForAnyYear(ctx, tone);

	const before = Object.values(fields).map(s => s.exact + s.setOnly);
	compareScalar(fields.headerText, facts.headerText, renderHeaderText(ctx), v => v);
	compareScalar(fields.tone, facts.tone, tone, v => String(v));
	compareSeq(fields.commemorations, facts.commemorations, getCommemorationsForAnyYear(ctx), commemKey);
	compareSeq(fields.troparia, facts.troparia, hymns.troparia, hymnKey);
	compareSeq(fields.kontakia, facts.kontakia, hymns.kontakia, hymnKey);
	const after = Object.values(fields).map(s => s.exact + s.setOnly);
	if (before.every((n, i) => (after[i] ?? n) === n + 1)) allPerfect++;
}

function pct(n: number): string { return ((n / total) * 100).toFixed(2) + "%"; }

console.log(`\n=== DayFacts reproducibility audit ===`);
console.log(`Days: ${total}`);
console.log(`Days where ALL 5 fields reproduce (set-equal): ${allPerfect} (${pct(allPerfect)})\n`);

const names = ["headerText", "tone", "commemorations", "troparia", "kontakia"] as const;
console.log("Field           exact     set-only   mismatch");
console.log("-----           -----     --------   --------");
for (const name of names) {
	const s = fields[name];
	console.log(
		`${name.padEnd(16)}${String(s.exact).padStart(5)} ${pct(s.exact).padStart(7)}` +
		`   ${String(s.setOnly).padStart(5)} ${pct(s.setOnly).padStart(7)}` +
		`   ${String(s.mismatch).padStart(5)} ${pct(s.mismatch).padStart(7)}`,
	);
}

const DETAIL_FIELDS = ["headerText", "commemorations", "troparia", "kontakia"] as const;
for (const name of DETAIL_FIELDS) {
	const s = fields[name];
	if (s.mismatch === 0) continue;
	console.log(`\n--- ${name} top missing (in HTOC, not reproduced) ---`);
	const missTop = [...s.missingBy].sort((a, b) => b[1] - a[1]).slice(0, 10);
	for (const [k, n] of missTop) console.log(`  [${String(n).padStart(3)}] ${k.slice(0, 140)}`);
	console.log(`--- ${name} top extra (reproduced, not in HTOC) ---`);
	const extraTop = [...s.extraBy].sort((a, b) => b[1] - a[1]).slice(0, 10);
	for (const [k, n] of extraTop) console.log(`  [${String(n).padStart(3)}] ${k.slice(0, 140)}`);
}
