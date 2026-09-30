// Phase 3 — machine-checkable comparators between the HTOC corpus and our
// engine, executed across the full 1095-day corpus. Emits
// `scratch/htoc-metrics.json` (per-day rows) and `scratch/htoc-metrics.md`
// (human summary). Read-only w.r.t. engine + corpus.
//
// Two comparators live here:
//
//   compareCommemorations(iso, htoc, engine) — token-set match of HTOC
//   commemoration text against every ResolvedSaint's name.{nominative,short,
//   long,index}. Reports htocOnly / engineOnly / matched counts + a coarse
//   rank-mismatch bucket.
//
//   compareReadings(iso, htoc, engine) — structural equality via
//   parseBibleRef. Merges every engine service into one bag, then walks
//   HTOC's list looking for structural matches.
//
// Both comparators are deliberately simple; Phase 4 will turn their outputs
// into per-day budgets.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { getLiturgicalDay } from "../../src/engine/index.ts";
import { getOrderedLiturgyReadings } from "../../src/engine/orderedLiturgy.ts";
import { getOrderedMatinsReadings } from "../../src/engine/orderedMatins.ts";
import { getDailyReadings } from "../../src/engine/readings.ts";
import type { ReadingRef } from "../../src/engine/readings.ts";
import { compareCommemorations, compareReadings } from "./comparators.ts";
import type { CommResult, ReadingResult } from "./comparators.ts";
import { iterCorpus, SCRATCH_DIR } from "./corpus.ts";
import type { HtocDay } from "./corpus.ts";

// ---------- driver ----------

interface DayMetric {
	iso: string;
	dow: number;
	nday: number;
	dRank: number;
	toneEngine: number | null;
	toneHtoc: number | null;
	toneMatch: boolean;
	commemorations: {
		htoc: number;
		engine: number;
		matched: number;
		htocOnly: number;
		engineOnly: number;
		rankMismatch: number;
	};
	readings: {
		htoc: number;
		engine: number;
		matched: number;
		htocOnly: number;
		engineOnly: number;
	};
}

interface CommemorationRankObs {
	htocRank: string;
	engineRank: number;
	count: number;
}

/** Fold the engine's 9-tier rank scale onto HTOC's 6-tier glyph scale for
 *  apples-to-apples comparison. Engine distinguishes Pascha (8) vs Lord (7)
 *  vs Theotokos (6) vs Vigil (5); HTOC uses "6" for every Great Feast and
 *  "4" for both Vigil and Polyeleos. */
function normalizeEngineRankToHtocGlyph(rank: number): string {
	if (rank >= 6) return "6";
	if (rank >= 4) return "4";
	return String(rank);
}

interface Aggregate {
	days: number;
	toneMatch: number;
	toneMismatch: number;
	toneEngineNull: number;
	toneHtocNull: number;
	commemorationHtocOnly: number;
	commemorationEngineOnly: number;
	commemorationMatched: number;
	readingHtocOnly: number;
	readingEngineOnly: number;
	readingMatched: number;
	perfectDays: number;
	rankObservations: Map<string, number>;
	worstCommDays: DayMetric[];
	worstReadingDays: DayMetric[];
}

function newAggregate(): Aggregate {
	return {
		days: 0,
		toneMatch: 0,
		toneMismatch: 0,
		toneEngineNull: 0,
		toneHtocNull: 0,
		commemorationHtocOnly: 0,
		commemorationEngineOnly: 0,
		commemorationMatched: 0,
		readingHtocOnly: 0,
		readingEngineOnly: 0,
		readingMatched: 0,
		perfectDays: 0,
		rankObservations: new Map(),
		worstCommDays: [],
		worstReadingDays: [],
	};
}

function toCal(iso: string): CalendarDate {
	const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
	return { year: y!, month: m!, day: d! };
}

function collectEngineReadings(cal: CalendarDate): ReadingRef[] {
	// Everything the engine emits for this day across all services. HTOC
	// mixes services in one list, so we do the same.
	const bag: ReadingRef[] = [];
	const lit = getOrderedLiturgyReadings(cal);
	for (const r of lit.apostol) bag.push(r);
	for (const r of lit.gospel) bag.push(r);
	const matins = getOrderedMatinsReadings(cal);
	for (const r of matins.refs) bag.push(r);
	// Suppressed refs stay in HTOC's view when they're festal Matins
	// gospels; include them so we don't over-report engineOnly.
	for (const r of matins.suppressed) bag.push(r);
	for (const service of ["vespers", "primes", "terce", "sexte", "none"] as const) {
		for (const r of getDailyReadings(cal, { service }).refs) bag.push(r);
	}
	// De-duplicate by (source|type|service|reading).
	const seen = new Set<string>();
	const out: ReadingRef[] = [];
	for (const r of bag) {
		const k = `${r.source}|${r.type}|${r.service}|${r.reading}`;
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(r);
	}
	return out;
}

function processOne(iso: string, htoc: HtocDay): {
	metric: DayMetric;
	comm: CommResult;
	read: ReadingResult;
} {
	const cal = toCal(iso);
	const day = getLiturgicalDay(cal);
	const readings = collectEngineReadings(cal);
	const comm = compareCommemorations(htoc.commemorations, day.allSaints);
	const read = compareReadings(htoc.scripture, readings);
	let rankMismatch = 0;
	for (const m of comm.matched) {
		if (m.engineRank === undefined) continue;
		rankMismatch++; // any pair where we compare against undefined would already be skipped; count where numeric available
	}
	// Better definition: rankMismatch = # pairs where engineRank present AND
	// glyph maps to a different bucket. For now just track observations for
	// later aggregation.
	rankMismatch = 0;

	const metric: DayMetric = {
		iso,
		dow: day.context.dow,
		nday: day.context.nday,
		dRank: day.dRank,
		toneEngine: day.tone,
		toneHtoc: htoc.tone,
		toneMatch: day.tone === htoc.tone,
		commemorations: {
			htoc: comm.htocCount,
			engine: comm.engineCount,
			matched: comm.matched.length,
			htocOnly: comm.htocOnly.length,
			engineOnly: comm.engineOnly.length,
			rankMismatch,
		},
		readings: {
			htoc: read.htocCount,
			engine: read.engineCount,
			matched: read.matched,
			htocOnly: read.htocOnly.length,
			engineOnly: read.engineOnly.length,
		},
	};
	return { metric, comm, read };
}

function aggregate(agg: Aggregate, metric: DayMetric, comm: CommResult): void {
	agg.days++;
	if (metric.toneMatch) agg.toneMatch++;
	else agg.toneMismatch++;
	if (metric.toneEngine === null) agg.toneEngineNull++;
	if (metric.toneHtoc === null) agg.toneHtocNull++;
	agg.commemorationHtocOnly += metric.commemorations.htocOnly;
	agg.commemorationEngineOnly += metric.commemorations.engineOnly;
	agg.commemorationMatched += metric.commemorations.matched;
	agg.readingHtocOnly += metric.readings.htocOnly;
	agg.readingEngineOnly += metric.readings.engineOnly;
	agg.readingMatched += metric.readings.matched;
	if (
		metric.commemorations.htocOnly === 0 &&
		metric.commemorations.engineOnly === 0 &&
		metric.readings.htocOnly === 0 &&
		metric.readings.engineOnly === 0
	) {
		agg.perfectDays++;
	}
	for (const m of comm.matched) {
		if (m.engineRank === undefined) continue;
		const key = `${m.htocRank}->${normalizeEngineRankToHtocGlyph(m.engineRank)}`;
		agg.rankObservations.set(key, (agg.rankObservations.get(key) ?? 0) + 1);
	}
	// Keep the top-20 worst days per axis.
	const insertSorted = (
		arr: DayMetric[],
		m: DayMetric,
		metricFn: (m: DayMetric) => number,
	) => {
		arr.push(m);
		arr.sort((a, b) => metricFn(b) - metricFn(a));
		if (arr.length > 20) arr.length = 20;
	};
	insertSorted(
		agg.worstCommDays,
		metric,
		(m) => m.commemorations.htocOnly + m.commemorations.engineOnly,
	);
	insertSorted(
		agg.worstReadingDays,
		metric,
		(m) => m.readings.htocOnly + m.readings.engineOnly,
	);
}

function writeJson(path: string, data: unknown): void {
	writeFileSync(path, `${JSON.stringify(data, null, "\t")}\n`, "utf8");
}

function renderSummary(agg: Aggregate, sampleRows: DayMetric[]): string {
	const l: string[] = [];
	l.push("# HTOC vs. engine — metrics");
	l.push("");
	l.push(
		"Generated by [scripts/analysis/metrics.ts](../scripts/analysis/metrics.ts) over all 1095 days.",
	);
	l.push("");
	l.push("## Aggregate totals");
	l.push("");
	l.push(`- Days processed: **${agg.days}**`);
	l.push(
		`- Perfect days (no htocOnly / engineOnly on comms + readings): **${agg.perfectDays}**`,
	);
	l.push(
		`- Tone: match=${agg.toneMatch}, mismatch=${agg.toneMismatch}, engine-null=${agg.toneEngineNull}, htoc-null=${agg.toneHtocNull}`,
	);
	l.push("");
	l.push("### Commemorations");
	l.push("");
	l.push(`- Matched (aggregate): **${agg.commemorationMatched}**`);
	l.push(`- HTOC-only (aggregate): **${agg.commemorationHtocOnly}**`);
	l.push(`- Engine-only (aggregate): **${agg.commemorationEngineOnly}**`);
	l.push(
		`- Coverage ratio: matched / (matched + htocOnly) = ${((agg.commemorationMatched / (agg.commemorationMatched + agg.commemorationHtocOnly)) * 100).toFixed(1)}%`,
	);
	l.push("");
	l.push("### Readings");
	l.push("");
	l.push(`- Matched (aggregate): **${agg.readingMatched}**`);
	l.push(`- HTOC-only (aggregate): **${agg.readingHtocOnly}**`);
	l.push(`- Engine-only (aggregate): **${agg.readingEngineOnly}**`);
	l.push(
		`- Coverage ratio: matched / (matched + htocOnly) = ${((agg.readingMatched / (agg.readingMatched + agg.readingHtocOnly)) * 100).toFixed(1)}%`,
	);
	l.push("");
	l.push("### Rank glyph ↔ engine rank observations");
	l.push("");
	l.push("| htocGlyph → engineGlyph | count |");
	l.push("| --- | ---:|");
	const rankRows = [...agg.rankObservations.entries()].sort(
		(a, b) => b[1] - a[1],
	);
	for (const [k, v] of rankRows) l.push(`| \`${k}\` | ${v} |`);
	l.push("");
	l.push(
		"Note: engine rank is only present for ~6/3371 cIds in the vendored corpus plus what `rankOverlay.ts` adds — that's why almost every match is engineRank-undefined and doesn't appear here. Engine rank is folded onto HTOC's 6-tier glyph scale before comparison (8/7/6 → \"6\", 5/4 → \"4\") so Great-Feasts-of-the-Lord (engine rank 7) and Vigil-rank saints (engine rank 5) match HTOC's coarser tiers cleanly.",
	);
	l.push("");
	l.push("## Worst 20 days by commemoration delta (htocOnly + engineOnly)");
	l.push("");
	l.push(
		"| iso | dow | nday | dRank | htoc | engine | matched | htocOnly | engineOnly |",
	);
	l.push("| --- | ---:| ---:| ---:| ---:| ---:| ---:| ---:| ---:|");
	for (const d of agg.worstCommDays) {
		l.push(
			`| ${d.iso} | ${d.dow} | ${d.nday} | ${d.dRank} | ${d.commemorations.htoc} | ${d.commemorations.engine} | ${d.commemorations.matched} | ${d.commemorations.htocOnly} | ${d.commemorations.engineOnly} |`,
		);
	}
	l.push("");
	l.push("## Worst 20 days by reading delta (htocOnly + engineOnly)");
	l.push("");
	l.push(
		"| iso | dow | nday | dRank | htoc | engine | matched | htocOnly | engineOnly |",
	);
	l.push("| --- | ---:| ---:| ---:| ---:| ---:| ---:| ---:| ---:|");
	for (const d of agg.worstReadingDays) {
		l.push(
			`| ${d.iso} | ${d.dow} | ${d.nday} | ${d.dRank} | ${d.readings.htoc} | ${d.readings.engine} | ${d.readings.matched} | ${d.readings.htocOnly} | ${d.readings.engineOnly} |`,
		);
	}
	l.push("");
	l.push("## Sample: 12 days (from `deltas.ts` list) — actual counts");
	l.push("");
	l.push(
		"| iso | comm h/e/matched/hOnly/eOnly | read h/e/matched/hOnly/eOnly | tone e/h |",
	);
	l.push("| --- | --- | --- | --- |");
	for (const d of sampleRows) {
		const c = d.commemorations;
		const r = d.readings;
		l.push(
			`| ${d.iso} | ${c.htoc}/${c.engine}/${c.matched}/${c.htocOnly}/${c.engineOnly} | ${r.htoc}/${r.engine}/${r.matched}/${r.htocOnly}/${r.engineOnly} | ${d.toneEngine ?? "-"}/${d.toneHtoc ?? "-"} |`,
		);
	}
	return `${l.join("\n")}\n`;
}

const SAMPLE_DAYS = new Set([
	"2025-03-14",
	"2025-04-18",
	"2025-04-21",
	"2025-04-25",
	"2025-06-08",
	"2025-06-27",
	"2025-08-07",
	"2025-08-19",
	"2025-08-28",
	"2025-11-30",
	"2026-01-06",
	"2026-01-07",
]);

function main(): void {
	if (!existsSync(SCRATCH_DIR)) mkdirSync(SCRATCH_DIR, { recursive: true });
	const agg = newAggregate();
	const rows: DayMetric[] = [];
	const sampleRows: DayMetric[] = [];
	let processed = 0;
	for (const { iso, day } of iterCorpus()) {
		const { metric, comm } = processOne(iso, day);
		aggregate(agg, metric, comm);
		rows.push(metric);
		if (SAMPLE_DAYS.has(iso)) sampleRows.push(metric);
		processed++;
		if (processed % 250 === 0) {
			process.stdout.write(`  processed ${processed} days\n`);
		}
	}
	writeJson(resolve(SCRATCH_DIR, "htoc-metrics.json"), {
		aggregate: {
			days: agg.days,
			perfectDays: agg.perfectDays,
			toneMatch: agg.toneMatch,
			toneMismatch: agg.toneMismatch,
			toneEngineNull: agg.toneEngineNull,
			toneHtocNull: agg.toneHtocNull,
			commemorationHtocOnly: agg.commemorationHtocOnly,
			commemorationEngineOnly: agg.commemorationEngineOnly,
			commemorationMatched: agg.commemorationMatched,
			readingHtocOnly: agg.readingHtocOnly,
			readingEngineOnly: agg.readingEngineOnly,
			readingMatched: agg.readingMatched,
			rankObservations: Object.fromEntries(agg.rankObservations),
		},
		days: rows,
	});
	writeFileSync(
		resolve(SCRATCH_DIR, "htoc-metrics.md"),
		renderSummary(agg, sampleRows),
		"utf8",
	);
	process.stdout.write(
		`wrote scratch/htoc-metrics.{json,md} — ${agg.days} days, ${agg.perfectDays} perfect\n`,
	);
}

main();
