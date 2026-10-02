// Phase B validator: compare algorithmic renderHeaderText against the
// hardcoded `headerText` field in DAY_FACTS_BY_ISO.

import { DAY_FACTS_BY_ISO } from "../../src/data/dayFacts.ts";
import { computeDayContext } from "../../src/engine/day.ts";
import { renderHeaderText } from "../../src/engine/headerText.ts";

type Row = {
	iso: string;
	nday: number;
	ndayP: number;
	dow: number;
	expected: string;
	actual: string;
};

const matches: Row[] = [];
const mismatches: Row[] = [];

for (const [iso, facts] of DAY_FACTS_BY_ISO) {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	const ctx = computeDayContext({ year: y, month: m, day: d });
	const actual = renderHeaderText(ctx);
	const row: Row = {
		iso,
		nday: ctx.nday,
		ndayP: ctx.ndayP,
		dow: ctx.dow,
		expected: facts.headerText,
		actual,
	};
	if (actual === facts.headerText) matches.push(row);
	else mismatches.push(row);
}

const total = matches.length + mismatches.length;
console.log(`\n=== Phase B header validation ===`);
console.log(`Total days: ${total}`);
console.log(`Matches:    ${matches.length} (${((matches.length / total) * 100).toFixed(2)}%)`);
console.log(`Mismatches: ${mismatches.length}`);

if (mismatches.length === 0) {
	console.log("\nAll 1095 vendored header strings match the renderer.");
	process.exit(0);
}

// Bucket mismatches by (expected, actual) kind to spot patterns.
const buckets = new Map<string, Row[]>();
for (const r of mismatches) {
	const key = `${r.expected} || GOT: ${r.actual}`;
	if (!buckets.has(key)) buckets.set(key, []);
	buckets.get(key)!.push(r);
}

console.log(`\nUnique mismatch patterns: ${buckets.size}`);
const sorted = [...buckets].sort((a, b) => b[1].length - a[1].length);
for (const [key, rows] of sorted.slice(0, 50)) {
	const sample = rows[0]!;
	console.log(`[n=${rows.length}] nday=${sample.nday} dow=${sample.dow}`);
	console.log(`  EXP: ${sample.expected}`);
	console.log(`  GOT: ${sample.actual}`);
}
if (sorted.length > 50) {
	console.log(`...${sorted.length - 50} more patterns`);
}
