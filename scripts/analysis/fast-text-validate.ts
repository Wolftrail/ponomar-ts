// Compare the algorithmic `renderFastText(ctx, level)` composer against
// the vendored `fastText` field in DAY_FACTS_BY_ISO across the full
// 2025-2027 corpus. Buckets mismatches so we can see which period / level
// combinations are drifting and whether the engine fasting level or the
// composer period name is the source of the gap.

import { DAY_FACTS_BY_ISO } from "../../src/data/dayFacts.ts";
import { computeDayContext } from "../../src/engine/day.ts";
import { computeFastingFromContext } from "../../src/engine/fasting.ts";
import { renderFastText } from "../../src/engine/fastText.ts";
import { getLiturgicalDay } from "../../src/engine/index.ts";

interface Row {
	iso: string;
	nday: number;
	dow: number;
	julian: string;
	expected: string;
	actual: string;
	level: string;
	periodExp: string;
	periodAct: string;
	suffixExp: string;
	suffixAct: string;
}

function split(s: string): { period: string; suffix: string } {
	const i = s.indexOf(". ");
	if (i < 0) return { period: s.replace(/\.$/, ""), suffix: "" };
	return { period: s.slice(0, i), suffix: s.slice(i + 2) };
}

const matches: Row[] = [];
const mismatches: Row[] = [];

for (const [iso, facts] of DAY_FACTS_BY_ISO) {
	const [ys, ms, ds] = iso.split("-");
	const greg = { year: Number(ys), month: Number(ms), day: Number(ds) };
	const ctx = computeDayContext(greg);
	const day = getLiturgicalDay(greg);
	const fasting = computeFastingFromContext(ctx, day.dRank);
	const actual = renderFastText(ctx, fasting.level);
	const { period: periodExp, suffix: suffixExp } = split(facts.fastText);
	const { period: periodAct, suffix: suffixAct } = split(actual);
	const row: Row = {
		iso,
		nday: ctx.nday,
		dow: ctx.dow,
		julian: `${ctx.julian.month}/${ctx.julian.day}`,
		expected: facts.fastText,
		actual,
		level: fasting.level,
		periodExp,
		periodAct,
		suffixExp,
		suffixAct,
	};
	if (actual === facts.fastText) matches.push(row);
	else mismatches.push(row);
}

const total = matches.length + mismatches.length;
console.log(`=== fastText validation ===`);
console.log(`Total days:  ${total}`);
console.log(`Matches:     ${matches.length} (${((matches.length / total) * 100).toFixed(2)}%)`);
console.log(`Mismatches:  ${mismatches.length}`);

if (mismatches.length === 0) {
	console.log(`\nAll ${total} vendored fastText strings match the composer.`);
	process.exit(0);
}

// Bucket 1: by divergence kind (period same? suffix same?).
const bKind = { periodOnly: 0, suffixOnly: 0, both: 0 };
for (const r of mismatches) {
	const pSame = r.periodExp === r.periodAct;
	const sSame = r.suffixExp === r.suffixAct;
	if (pSame && !sSame) bKind.suffixOnly++;
	else if (!pSame && sSame) bKind.periodOnly++;
	else bKind.both++;
}
console.log(`\n=== Divergence kind ===`);
console.log(`  period same, suffix differs:  ${bKind.suffixOnly}`);
console.log(`  period differs, suffix same:  ${bKind.periodOnly}`);
console.log(`  both differ:                  ${bKind.both}`);

// Bucket 2: by (expected period → actual period).
const periodMap = new Map<string, number>();
for (const r of mismatches) {
	const key = `${r.periodExp || "<empty>"}  →  ${r.periodAct || "<empty>"}`;
	periodMap.set(key, (periodMap.get(key) ?? 0) + 1);
}
console.log(`\n=== Period mismatches (expected → actual) ===`);
for (const [k, n] of [...periodMap].sort((a, b) => b[1] - a[1])) {
	console.log(`  ${String(n).padStart(4)}  ${k}`);
}

// Bucket 3: by (expected suffix → actual suffix), restricted to rows where
// the period is already correct — isolates pure engine-level drift.
const suffixMap = new Map<string, number>();
for (const r of mismatches) {
	if (r.periodExp !== r.periodAct) continue;
	const key = `${r.suffixExp || "<empty>"}  →  ${r.suffixAct || "<empty>"}`;
	suffixMap.set(key, (suffixMap.get(key) ?? 0) + 1);
}
console.log(`\n=== Suffix mismatches on period-correct days (expected → actual) ===`);
for (const [k, n] of [...suffixMap].sort((a, b) => b[1] - a[1])) {
	console.log(`  ${String(n).padStart(4)}  ${k}`);
}

// Bucket 4: by engine level that produced the mismatch.
const levelMap = new Map<string, number>();
for (const r of mismatches) {
	levelMap.set(r.level, (levelMap.get(r.level) ?? 0) + 1);
}
console.log(`\n=== Mismatches by engine fasting level ===`);
for (const [k, n] of [...levelMap].sort((a, b) => b[1] - a[1])) {
	console.log(`  ${String(n).padStart(4)}  ${k}`);
}

// Sample rows: first few in each divergence bucket.
console.log(`\n=== Sample rows (first 25 mismatches) ===`);
for (const r of mismatches.slice(0, 25)) {
	console.log(
		`  ${r.iso} dow=${r.dow} nday=${String(r.nday).padStart(4)} Jul=${r.julian.padStart(5)} ` +
		`lvl=${r.level.padEnd(14)}`,
	);
	console.log(`    exp: "${r.expected}"`);
	console.log(`    got: "${r.actual}"`);
}
