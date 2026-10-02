// Commemoration coverage report, bucketed by HTOC rank glyph. Mirrors
// `liturgy-coverage.ts` in spirit: per-bucket matched/only/engineOnly
// counts, a per-day distribution histogram, and a top-N table of recurring
// only entries so we can see which saints the engine is missing most.
//
// Run:  node --experimental-strip-types scripts/analysis/commemoration-coverage.ts

import type { CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { getLiturgicalDay } from "../../src/engine/index.ts";
import { unmapRank } from "../../src/engine/saints.ts";
import { compareCommemorations, tokens } from "./comparators.ts";
import { iterCorpus } from "./corpus.ts";
import type { Commemoration } from "./corpus.ts";

/** Normalize the engine's rank onto HTOC's glyph. Engine ranks are now
 *  sourced from HTOC's own glyph via `mapRank`, so `unmapRank` is
 *  the exact inverse except that HTOC `"1"` (simple) and `"o"` (octoechos)
 *  both collapse to Ponomar 1; callers must treat `{"1", "o"}` as a single
 *  equivalence class when comparing. */
function normalizeEngineRankToGlyph(rank: number): string {
	return unmapRank(rank);
}

function glyphEqual(engineGlyph: string, glyph: string): boolean {
	if (engineGlyph === glyph) return true;
	return engineGlyph === "1" && glyph === "o";
}

const RANK_LABELS: Readonly<Record<string, string>> = {
	"6": "Great Feast",
	"5": "Vigil",
	"4": "Polyeleos",
	"3": "Doxology (red cross)",
	"2": "Six-stich (black bracket)",
	"1": "Simple commemoration",
	"0": "No sign",
	o: "Octoechos / weekday",
};

const BUCKETS = ["6", "5", "4", "3", "2", "1", "0", "o", "other"] as const;
type Bucket = (typeof BUCKETS)[number];

function bucketOfHtoc(c: Commemoration): Bucket {
	const r = c.rank.trim();
	if (BUCKETS.includes(r as Bucket)) return r as Bucket;
	return "other";
}

function toCal(iso: string): CalendarDate {
	const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
	return { year: y!, month: m!, day: d! };
}

interface Totals {
	matched: number;
	only: number;
}
function newTotals(): Totals { return { matched: 0, only: 0 }; }

const perBucket: Record<Bucket, Totals> = Object.fromEntries(
	BUCKETS.map((b) => [b, newTotals()]),
) as Record<Bucket, Totals>;

// Per-day distribution: how many days have N only commemorations.
const dayHistogram = new Map<number, number>();
// Recurring only texts (normalized token signature → count + sample).
const recurring = new Map<string, { count: number; sample: string; bucket: Bucket }>();
// Engine-only tracking (saints the engine fires that HTOC never mentions).
let engineOnlyTotal = 0;
const engineOnlyRecurring = new Map<string, { count: number; sample: string }>();

let days = 0;
let engineOnlyRankMismatch = 0; // matched pair where engine glyph != htoc glyph
const rankConfusion = new Map<string, number>(); // "glyph→engineGlyph" → count

for (const { iso, day: day } of iterCorpus()) {
	days++;
	const cal = toCal(iso);
	const engineDay = getLiturgicalDay(cal);
	const cmp = compareCommemorations(day.commemorations, engineDay.allSaints);
	// Credit matched comms to their HTOC bucket.
	for (const m of cmp.matched) {
		const comm = day.commemorations[m.index]!;
		const b = bucketOfHtoc(comm);
		perBucket[b].matched++;
		if (m.engineRank !== undefined) {
			const engineGlyph = normalizeEngineRankToGlyph(m.engineRank);
			if (!glyphEqual(engineGlyph, comm.rank)) {
				engineOnlyRankMismatch++;
				const key = `${comm.rank}→${engineGlyph}`;
				rankConfusion.set(key, (rankConfusion.get(key) ?? 0) + 1);
			}
		}
	}
	// Debit only to its bucket.
	for (const h of cmp.only) {
		const b = bucketOfHtoc(h as Commemoration);
		perBucket[b].only++;
		const sig = [...tokens(h.text)].sort().join(" ");
		if (sig === "") continue;
		const row = recurring.get(sig);
		if (row === undefined) {
			recurring.set(sig, { count: 1, sample: h.text, bucket: b });
		} else {
			row.count++;
		}
	}
	dayHistogram.set(
		cmp.only.length,
		(dayHistogram.get(cmp.only.length) ?? 0) + 1,
	);
	engineOnlyTotal += cmp.engineOnly.length;
	for (const e of cmp.engineOnly) {
		const sig = e.name.toLowerCase();
		const row = engineOnlyRecurring.get(sig);
		if (row === undefined) {
			engineOnlyRecurring.set(sig, { count: 1, sample: e.name });
		} else {
			row.count++;
		}
	}
}

const grandMatched = BUCKETS.reduce((n, b) => n + perBucket[b].matched, 0);
const grandOnly = BUCKETS.reduce((n, b) => n + perBucket[b].only, 0);

console.log(`\nHTOC commemoration coverage — ${days} days\n`);
console.log("Bucket | label                       | matched | only | coverage%");
console.log("------ | --------------------------- | ------: | -------: | --------:");
for (const b of BUCKETS) {
	const t = perBucket[b];
	if (t.matched === 0 && t.only === 0) continue;
	const denom = t.matched + t.only;
	const pct = denom === 0 ? "n/a" : `${((t.matched / denom) * 100).toFixed(1)}%`;
	const label = RANK_LABELS[b] ?? "(other)";
	console.log(
		`${b.padEnd(6)} | ${label.padEnd(27)} | ${String(t.matched).padStart(7)} | ${String(t.only).padStart(8)} | ${pct.padStart(9)}`,
	);
}
const overallDenom = grandMatched + grandOnly;
const overallPct = overallDenom === 0 ? "n/a" : `${((grandMatched / overallDenom) * 100).toFixed(1)}%`;
console.log(
	`TOTAL  | ${"".padEnd(27)} | ${String(grandMatched).padStart(7)} | ${String(grandOnly).padStart(8)} | ${overallPct.padStart(9)}`,
);
console.log(`\nEngine-only commemorations (saints engine fires HTOC never mentions): ${engineOnlyTotal}`);
console.log(`Matched pairs with rank-glyph mismatch: ${engineOnlyRankMismatch}`);

if (rankConfusion.size > 0) {
	console.log("\nRank-glyph confusion (matched pairs where engine rank ≠ htoc glyph):");
	const sortedRc = [...rankConfusion.entries()].sort((a, b) => b[1] - a[1]);
	for (const [k, v] of sortedRc) console.log(`  ${k}: ${v}`);
}

console.log("\nPer-day only distribution:");
const histKeys = [...dayHistogram.keys()].sort((a, b) => a - b);
for (const k of histKeys) {
	const n = dayHistogram.get(k)!;
	const bar = "█".repeat(Math.min(60, Math.round(n / Math.max(1, Math.max(...dayHistogram.values()) / 60))));
	console.log(`  ${String(k).padStart(3)} only: ${String(n).padStart(4)} days ${bar}`);
}

console.log("\nTop 25 recurring only commemorations:");
const sortedRec = [...recurring.entries()].sort((a, b) => b[1].count - a[1].count);
for (const [, row] of sortedRec.slice(0, 25)) {
	const txt = row.sample.replace(/\s+/g, " ").trim().slice(0, 90);
	console.log(`  ${String(row.count).padStart(4)} × [${row.bucket}] ${txt}`);
}

console.log("\nTop 15 recurring engine-only entries:");
const sortedEo = [...engineOnlyRecurring.entries()].sort((a, b) => b[1].count - a[1].count);
for (const [, row] of sortedEo.slice(0, 15)) {
	console.log(`  ${String(row.count).padStart(4)} × ${row.sample}`);
}
