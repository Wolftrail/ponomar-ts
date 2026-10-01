// Phase C1 validator: measures how many commemorations in the vendored HTOC
// corpus can be reproduced by the fixed-Julian layer + synthesized season
// markers. The gap is movable overlays (paschal/triodion/DOW-shift), which
// are left to later sub-phases.

import { HTOC_DAY_FACTS_BY_ISO } from "../../src/data/htocDayFacts.ts";
import { computeDayContext } from "../../src/engine/day.ts";
import { getCommemorationsForAnyYear } from "../../src/engine/commemorations.ts";

function keyOf(c: { rank: string; text: string; minor: boolean }): string {
	return `${c.rank}|${c.minor ? 1 : 0}|${c.text}`;
}

let totalExpected = 0;
let totalGot = 0;
let totalIntersection = 0;
let totalMissing = 0;
let totalExtra = 0;
let perfectDays = 0;
const totalDays = HTOC_DAY_FACTS_BY_ISO.size;

const missingByText = new Map<string, number>();
const extraByText = new Map<string, number>();

for (const [iso, facts] of HTOC_DAY_FACTS_BY_ISO) {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	const ctx = computeDayContext({ year: y, month: m, day: d });
	const got = getCommemorationsForAnyYear(ctx);
	const expectedKeys = new Set(facts.commemorations.map(keyOf));
	const gotKeys = new Set(got.map(keyOf));
	let inter = 0;
	for (const k of expectedKeys) if (gotKeys.has(k)) inter++;
	totalExpected += expectedKeys.size;
	totalGot += gotKeys.size;
	totalIntersection += inter;
	for (const k of expectedKeys) if (!gotKeys.has(k)) {
		totalMissing++;
		const text = k.split("|").slice(2).join("|");
		missingByText.set(text, (missingByText.get(text) ?? 0) + 1);
	}
	for (const k of gotKeys) if (!expectedKeys.has(k)) {
		totalExtra++;
		const text = k.split("|").slice(2).join("|");
		extraByText.set(text, (extraByText.get(text) ?? 0) + 1);
	}
	if (inter === expectedKeys.size && gotKeys.size === expectedKeys.size) perfectDays++;
}

console.log(`\n=== Phase C1 commemoration coverage ===`);
console.log(`Days:                ${totalDays}`);
console.log(`Perfect-match days:  ${perfectDays} (${((perfectDays / totalDays) * 100).toFixed(1)}%)`);
console.log(`Expected total:      ${totalExpected}`);
console.log(`Got total:           ${totalGot}`);
console.log(`Correct entries:     ${totalIntersection} (${((totalIntersection / totalExpected) * 100).toFixed(1)}% of expected)`);
console.log(`Missing entries:     ${totalMissing}`);
console.log(`Extra entries:       ${totalExtra}`);

const topMissing = [...missingByText].sort((a, b) => b[1] - a[1]).slice(0, 20);
if (topMissing.length) {
	console.log(`\nTop missing entries (not yet in fixed/season layer):`);
	for (const [text, n] of topMissing) {
		console.log(`  [${n}]  ${text.slice(0, 110)}`);
	}
}

const topExtra = [...extraByText].sort((a, b) => b[1] - a[1]).slice(0, 20);
if (topExtra.length) {
	console.log(`\nTop extra entries (algo added, HTOC did not print):`);
	for (const [text, n] of topExtra) {
		console.log(`  [${n}]  ${text.slice(0, 110)}`);
	}
}
