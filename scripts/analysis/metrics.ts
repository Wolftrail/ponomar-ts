// Phase 3 — machine-checkable comparators between the HTOC corpus and our
// engine, executed across the full 1095-day corpus. Emits
// `scratch/htoc-metrics.json` (per-day rows) and `scratch/htoc-metrics.md`
// (human summary). Read-only w.r.t. engine + corpus.
//
// Two comparators live here:
//
//   compareCommemorations(iso, htoc, engine) — token-set match of HTOC
//   commemoration text against every ResolvedSaint's name.{nominative,short,
//   long,index}. Reports only / engineOnly / matched counts + a coarse
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
import { getDayFacts } from "../../src/engine/dayFacts.ts";
import { unmapRank } from "../../src/engine/saints.ts";
import { getOrderedLiturgyReadings } from "../../src/engine/orderedLiturgy.ts";
import { getOrderedMatinsReadings } from "../../src/engine/orderedMatins.ts";
import { getDailyReadings } from "../../src/engine/readings.ts";
import type { ReadingRef } from "../../src/engine/readings.ts";
import { compareCommemorations, compareReadings, tokens } from "./comparators.ts";
import type { CommResult, ReadingResult } from "./comparators.ts";
import { iterCorpus, SCRATCH_DIR } from "./corpus.ts";
import type { Day } from "./corpus.ts";

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
		only: number;
		engineOnly: number;
		rankMismatch: number;
	};
	readings: {
		htoc: number;
		engine: number;
		matched: number;
		only: number;
		engineOnly: number;
	};
	troparionCount: number;
	kontakionCount: number;
	/** HTOC-published commemoration count on `day.commemorations`. Should
	 *  equal `commemorations.htoc` on every covered day since both come
	 *  from the same HTOC day-page scrape. */
	userFacingCommemorationCount: number;
}

interface CommemorationRankObs {
	rank: string;
	engineRank: number;
	count: number;
}

/** Fold the engine's 9-tier rank scale onto HTOC's 6-tier glyph scale for
 *  apples-to-apples comparison. Engine distinguishes Pascha (8) vs Lord (7)
 *  vs Theotokos (6) vs Vigil (5); HTOC uses "6" for every Great Feast.
 *  Engine ranks are now sourced from HTOC's own glyph via `mapRank`,
 *  so `unmapRank` is the exact inverse except for the deliberate
 *  `{"1", "o"} → 1` collapse (both tiers round-trip to `"1"`). */
function normalizeEngineRankToGlyph(rank: number): string {
	return unmapRank(rank);
}

interface Aggregate {
	days: number;
	toneMatch: number;
	toneMismatch: number;
	toneEngineNull: number;
	toneNull: number;
	commemorationOnly: number;
	commemorationEngineOnly: number;
	commemorationMatched: number;
	readingOnly: number;
	readingEngineOnly: number;
	readingMatched: number;
	troparionTotal: number;
	kontakionTotal: number;
	factsCoverage: number;
	userFacingCommemorationTotal: number;
	userFacingCommemorationCountMismatches: number;
	perfectDays: number;
	rankObservations: Map<string, number>;
	worstCommDays: DayMetric[];
	worstReadingDays: DayMetric[];
	commByBucket: Map<string, { matched: number; only: number }>;
	commOnlyRecurring: Map<string, { count: number; sample: string; bucket: string }>;
}

function newAggregate(): Aggregate {
	return {
		days: 0,
		toneMatch: 0,
		toneMismatch: 0,
		toneEngineNull: 0,
		toneNull: 0,
		commemorationOnly: 0,
		commemorationEngineOnly: 0,
		commemorationMatched: 0,
		readingOnly: 0,
		readingEngineOnly: 0,
		readingMatched: 0,
		troparionTotal: 0,
		kontakionTotal: 0,
		factsCoverage: 0,
		userFacingCommemorationTotal: 0,
		userFacingCommemorationCountMismatches: 0,
		perfectDays: 0,
		rankObservations: new Map(),
		worstCommDays: [],
		worstReadingDays: [],
		commByBucket: new Map(),
		commOnlyRecurring: new Map(),
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
	// Include suppressed Liturgy readings — HTOC still lists them (e.g. the
	// ordinary Saturday reading on a festal Saturday) so excluding them
	// manufactures only misses.
	for (const r of lit.suppressed) bag.push(r);
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

function processOne(iso: string, htoc: Day): {
	metric: DayMetric;
	comm: CommResult;
	read: ReadingResult;
} {
	const cal = toCal(iso);
	const day = getLiturgicalDay(cal);
	const readings = collectEngineReadings(cal);
	const comm = compareCommemorations(htoc.commemorations, day.allSaints);
	const read = compareReadings(htoc.scripture, readings);
	const facts = getDayFacts(cal);
	const troparionCount = facts?.troparia.length ?? 0;
	const kontakionCount = facts?.kontakia.length ?? 0;
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
			htoc: comm.count,
			engine: comm.engineCount,
			matched: comm.matched.length,
			only: comm.only.length,
			engineOnly: comm.engineOnly.length,
			rankMismatch,
		},
		readings: {
			htoc: read.count,
			engine: read.engineCount,
			matched: read.matched,
			only: read.only.length,
			engineOnly: read.engineOnly.length,
		},
		troparionCount,
		kontakionCount,
		userFacingCommemorationCount: day.commemorations.length,
	};
	return { metric, comm, read };
}

function aggregate(agg: Aggregate, metric: DayMetric, comm: CommResult): void {
	agg.days++;
	if (metric.toneMatch) agg.toneMatch++;
	else agg.toneMismatch++;
	if (metric.toneEngine === null) agg.toneEngineNull++;
	if (metric.toneHtoc === null) agg.toneNull++;
	agg.commemorationOnly += metric.commemorations.only;
	agg.commemorationEngineOnly += metric.commemorations.engineOnly;
	agg.commemorationMatched += metric.commemorations.matched;
	agg.readingOnly += metric.readings.only;
	agg.readingEngineOnly += metric.readings.engineOnly;
	agg.readingMatched += metric.readings.matched;
	agg.troparionTotal += metric.troparionCount;
	agg.kontakionTotal += metric.kontakionCount;
	if (metric.troparionCount + metric.kontakionCount > 0) agg.factsCoverage++;
	agg.userFacingCommemorationTotal += metric.userFacingCommemorationCount;
	if (metric.userFacingCommemorationCount !== metric.commemorations.htoc) {
		agg.userFacingCommemorationCountMismatches++;
	}
	if (
		metric.commemorations.only === 0 &&
		metric.commemorations.engineOnly === 0 &&
		metric.readings.only === 0 &&
		metric.readings.engineOnly === 0
	) {
		agg.perfectDays++;
	}
	for (const m of comm.matched) {
		if (m.engineRank === undefined) continue;
		const key = `${m.rank}->${normalizeEngineRankToGlyph(m.engineRank)}`;
		agg.rankObservations.set(key, (agg.rankObservations.get(key) ?? 0) + 1);
		const bucket = m.rank === "" ? "(blank)" : m.rank;
		const row = agg.commByBucket.get(bucket) ?? { matched: 0, only: 0 };
		row.matched++;
		agg.commByBucket.set(bucket, row);
	}
	// Count matched comms where engineRank is undefined too (bucket by htoc).
	for (const m of comm.matched) {
		if (m.engineRank !== undefined) continue;
		const bucket = m.rank === "" ? "(blank)" : m.rank;
		const row = agg.commByBucket.get(bucket) ?? { matched: 0, only: 0 };
		row.matched++;
		agg.commByBucket.set(bucket, row);
	}
	for (const h of comm.only) {
		const bucket = h.rank === "" ? "(blank)" : h.rank;
		const row = agg.commByBucket.get(bucket) ?? { matched: 0, only: 0 };
		row.only++;
		agg.commByBucket.set(bucket, row);
		const sig = [...tokens(h.text)].sort().join(" ");
		if (sig === "") continue;
		const r = agg.commOnlyRecurring.get(sig);
		if (r === undefined) {
			agg.commOnlyRecurring.set(sig, { count: 1, sample: h.text, bucket });
		} else {
			r.count++;
		}
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
		(m) => m.commemorations.only + m.commemorations.engineOnly,
	);
	insertSorted(
		agg.worstReadingDays,
		metric,
		(m) => m.readings.only + m.readings.engineOnly,
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
		`- Perfect days (no only / engineOnly on comms + readings): **${agg.perfectDays}**`,
	);
	l.push(
		`- Tone: match=${agg.toneMatch}, mismatch=${agg.toneMismatch}, engine-null=${agg.toneEngineNull}, null=${agg.toneNull}`,
	);
	l.push("");
	l.push("### Commemorations");
	l.push("");
	l.push("**User-facing coverage** — `LiturgicalDay.commemorations` is the HTOC day-page commemoration list vendored verbatim via `dayFacts.ts`. Any UI that renders `day.commemorations` renders exactly what HTOC publishes.");
	l.push("");
	l.push(
		`- Days with HTOC commemoration data: **${agg.factsCoverage}** / ${agg.days}`,
	);
	l.push(
		`- Total commemorations surfaced on \`day.commemorations\`: **${agg.userFacingCommemorationTotal}**`,
	);
	l.push(
		`- Days where \`day.commemorations.length\` disagrees with the HTOC corpus count: **${agg.userFacingCommemorationCountMismatches}**`,
	);
	l.push("");
	l.push("**Structural coverage** — the metrics below compare the HTOC-sourced `LiturgicalDay.allSaints` list (synthetic `htoc:` cIds, HTOC rank glyph on `church.rank`) against the HTOC published commemoration list that fed it. Since `allSaints` is now a direct projection of HTOC's own list, coverage is 100.0% by construction; this section is kept for continuity with historical reports.");
	l.push("");
	l.push(`- Matched (aggregate): **${agg.commemorationMatched}**`);
	l.push(`- HTOC-only (aggregate): **${agg.commemorationOnly}**`);
	l.push(`- Engine-only (aggregate): **${agg.commemorationEngineOnly}**`);
	l.push(
		`- Coverage ratio: matched / (matched + only) = ${((agg.commemorationMatched / (agg.commemorationMatched + agg.commemorationOnly)) * 100).toFixed(1)}%`,
	);
	l.push("");
	l.push("#### Commemorations by HTOC rank-glyph bucket");
	l.push("");
	l.push("HTOC's rank glyphs: `6` Great Feast / `5` Vigil / `4` Polyeleos / `3` Doxology / `2` Six-stich / `1` Simple commemoration / `0` No sign / `o` Octoechos (weekday saints, including most New Hieromartyrs).");
	l.push("");
	l.push("| bucket | matched | only | coverage% |");
	l.push("| --- | ---:| ---:| ---:|");
	const bucketOrder = ["6", "4", "3", "2", "1", "0", "o", "(blank)"];
	const seenBuckets = new Set<string>();
	const printBucket = (b: string) => {
		const row = agg.commByBucket.get(b);
		if (row === undefined) return;
		seenBuckets.add(b);
		const denom = row.matched + row.only;
		const pct = denom === 0 ? "n/a" : `${((row.matched / denom) * 100).toFixed(1)}%`;
		l.push(`| \`${b}\` | ${row.matched} | ${row.only} | ${pct} |`);
	};
	for (const b of bucketOrder) printBucket(b);
	for (const b of agg.commByBucket.keys()) {
		if (!seenBuckets.has(b)) printBucket(b);
	}
	l.push("");
	l.push("#### Top 20 recurring HTOC-only commemorations");
	l.push("");
	l.push("These are the saints HTOC lists most often that the engine never surfaces. The long tail is dominated by New Hieromartyrs (20th-century Russian martyrs) — they live in a separate HTOC addendum rather than the vendored Ponomar `xml/` corpus.");
	l.push("");
	l.push("| count | rank | text |");
	l.push("| ---:| --- | --- |");
	const recRows = [...agg.commOnlyRecurring.entries()]
		.sort((a, b) => b[1].count - a[1].count)
		.slice(0, 20);
	for (const [, row] of recRows) {
		const txt = row.sample.replace(/\s+/g, " ").trim().slice(0, 110).replace(/\|/g, "\\|");
		l.push(`| ${row.count} | \`${row.bucket}\` | ${txt} |`);
	}
	l.push("");
	l.push("### Readings");
	l.push("");
	l.push(`- Matched (aggregate): **${agg.readingMatched}**`);
	l.push(`- HTOC-only (aggregate): **${agg.readingOnly}**`);
	l.push(`- Engine-only (aggregate): **${agg.readingEngineOnly}**`);
	l.push(
		`- Coverage ratio: matched / (matched + only) = ${((agg.readingMatched / (agg.readingMatched + agg.readingOnly)) * 100).toFixed(1)}%`,
	);
	l.push("");
	l.push("### Propers (HTOC-published troparia & kontakia)");
	l.push("");
	l.push(
		`- Days with HTOC propers data: **${agg.factsCoverage}** / ${agg.days}`,
	);
	l.push(`- Total troparia (HTOC publication order): **${agg.troparionTotal}**`);
	l.push(`- Total kontakia (HTOC publication order): **${agg.kontakionTotal}**`);
	l.push("");
	l.push(
		"`getPropers(date)` is a thin filter over `LiturgicalDay.troparia` / `kontakia`, both sourced verbatim from HTOC via `dayFacts.ts`. There is no XML-vs-HTOC comparison here: the two API channels are the same data. Dates outside the vendored HTOC coverage window return empty arrays.",
	);
	l.push("");
	l.push("### Rank glyph ↔ engine rank observations");
	l.push("");
	l.push("| glyph → engineGlyph | count |");
	l.push("| --- | ---:|");
	const rankRows = [...agg.rankObservations.entries()].sort(
		(a, b) => b[1] - a[1],
	);
	for (const [k, v] of rankRows) l.push(`| \`${k}\` | ${v} |`);
	l.push("");
	l.push(
		"Note: `LiturgicalDay.allSaints` is now the HTOC-published commemoration list projected into `ResolvedSaint` shape (synthetic `htoc:` cIds, `church.rank` sourced from HTOC's own glyph via `mapRank`). The round-trip through `unmapRank` is a bijection on `{\"6\", \"5\", \"4\", \"3\", \"2\", \"0\"}`; HTOC `\"1\"` (simple) and `\"o\"` (octoechos) deliberately collapse onto Ponomar rank 1 and both round-trip to `\"1\"`.",
	);
	l.push("");
	l.push("## Worst 20 days by commemoration delta (only + engineOnly)");
	l.push("");
	l.push(
		"| iso | dow | nday | dRank | htoc | engine | matched | only | engineOnly |",
	);
	l.push("| --- | ---:| ---:| ---:| ---:| ---:| ---:| ---:| ---:|");
	for (const d of agg.worstCommDays) {
		l.push(
			`| ${d.iso} | ${d.dow} | ${d.nday} | ${d.dRank} | ${d.commemorations.htoc} | ${d.commemorations.engine} | ${d.commemorations.matched} | ${d.commemorations.only} | ${d.commemorations.engineOnly} |`,
		);
	}
	l.push("");
	l.push("## Worst 20 days by reading delta (only + engineOnly)");
	l.push("");
	l.push(
		"| iso | dow | nday | dRank | htoc | engine | matched | only | engineOnly |",
	);
	l.push("| --- | ---:| ---:| ---:| ---:| ---:| ---:| ---:| ---:|");
	for (const d of agg.worstReadingDays) {
		l.push(
			`| ${d.iso} | ${d.dow} | ${d.nday} | ${d.dRank} | ${d.readings.htoc} | ${d.readings.engine} | ${d.readings.matched} | ${d.readings.only} | ${d.readings.engineOnly} |`,
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
			`| ${d.iso} | ${c.htoc}/${c.engine}/${c.matched}/${c.only}/${c.engineOnly} | ${r.htoc}/${r.engine}/${r.matched}/${r.only}/${r.engineOnly} | ${d.toneEngine ?? "-"}/${d.toneHtoc ?? "-"} |`,
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
	writeJson(resolve(SCRATCH_DIR, "metrics.json"), {
		aggregate: {
			days: agg.days,
			perfectDays: agg.perfectDays,
			toneMatch: agg.toneMatch,
			toneMismatch: agg.toneMismatch,
			toneEngineNull: agg.toneEngineNull,
			toneNull: agg.toneNull,
			commemorationOnly: agg.commemorationOnly,
			commemorationEngineOnly: agg.commemorationEngineOnly,
			commemorationMatched: agg.commemorationMatched,
			readingOnly: agg.readingOnly,
			readingEngineOnly: agg.readingEngineOnly,
			readingMatched: agg.readingMatched,
			troparionTotal: agg.troparionTotal,
			kontakionTotal: agg.kontakionTotal,
			factsCoverage: agg.factsCoverage,
			rankObservations: Object.fromEntries(agg.rankObservations),
		},
		days: rows,
	});
	writeFileSync(
		resolve(SCRATCH_DIR, "metrics.md"),
		renderSummary(agg, sampleRows),
		"utf8",
	);
	process.stdout.write(
		`wrote scratch/htoc-metrics.{json,md} — ${agg.days} days, ${agg.perfectDays} perfect\n`,
	);
}

main();
