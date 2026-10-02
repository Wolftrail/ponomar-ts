// Phase A validator: compare algorithmic `getOctoechosTone` against the
// hardcoded `tone` field in DAY_FACTS_BY_ISO across the full 2025-2027
// vendored corpus. Prints a mismatch table and summary.

import { DAY_FACTS_BY_ISO } from "../../src/engine/dayFacts.ts";
import { computeDayContext } from "../../src/engine/day.ts";
import { getOctoechosTone, rawOctoechosTone } from "../../src/engine/tone.ts";

type Row = {
	iso: string;
	nday: number;
	ndayP: number;
	dow: number;
	expected: number | null;
	actual: number | null;
	raw: number;
	header: string;
};

const matches: Row[] = [];
const mismatches: Row[] = [];

for (const [iso, facts] of DAY_FACTS_BY_ISO) {
	const [ys, ms, ds] = iso.split("-");
	const greg = { year: Number(ys), month: Number(ms), day: Number(ds) };
	const ctx = computeDayContext(greg);
	const actual = getOctoechosTone(ctx);
	const raw = rawOctoechosTone(ctx);
	const row: Row = {
		iso,
		nday: ctx.nday,
		ndayP: ctx.ndayP,
		dow: ctx.dow,
		expected: facts.tone,
		actual,
		raw,
		header: facts.headerText,
	};
	if (facts.tone === actual) matches.push(row);
	else mismatches.push(row);
}

const total = matches.length + mismatches.length;
console.log(`\n=== Phase A tone validation ===`);
console.log(`Total days: ${total}`);
console.log(`Matches:    ${matches.length} (${((matches.length / total) * 100).toFixed(2)}%)`);
console.log(`Mismatches: ${mismatches.length}`);

if (mismatches.length === 0) {
	console.log("\nAll 1095 vendored tone values match the algorithm.");
	process.exit(0);
}

// Bucket mismatches by (expected, actual) kind.
const buckets = new Map<string, Row[]>();
for (const r of mismatches) {
	const key = `expected=${r.expected} actual=${r.actual}`;
	if (!buckets.has(key)) buckets.set(key, []);
	buckets.get(key)!.push(r);
}

console.log("\nMismatch buckets:");
for (const [k, rows] of [...buckets].sort((a, b) => b[1].length - a[1].length)) {
	console.log(`  ${k}: ${rows.length}`);
}

console.log(`\nAll mismatches:`);
for (const r of mismatches) {
	console.log(
		`  ${r.iso} dow=${r.dow} nday=${String(r.nday).padStart(4)} ndayP=${String(r.ndayP).padStart(4)} ` +
		`exp=${String(r.expected).padStart(4)} got=${String(r.actual).padStart(4)} raw=${r.raw} :: ${r.header}`,
	);
}
