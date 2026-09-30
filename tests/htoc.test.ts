// HTOC regression suite. Compares the engine's output to
// holytrinityorthodox.com's reference data across two axes:
//
//   1. **Keystone-day exact assertions.** For Pascha, Nativity, Theophany,
//      Transfiguration, and Dormition we hard-code the HTOC Liturgy
//      apostol, Liturgy gospel, and festal Matins gospel. These run
//      unconditionally — they don't need the scraped corpus on disk.
//
//   2. **Corpus-wide budgets.** When the `tests/fixtures/htoc-full-*.json`
//      files are present (they're gitignored), we run the full 1095-day
//      comparison and assert coverage floors. Values are the current
//      measured baseline minus a small slack margin, so intentional
//      regressions in later data changes will fail. Improvements will nudge
//      the baseline up.
//
// See `scratch/htoc-metrics.md` for how the current budget was measured
// and `scripts/analysis/*` for the tools that produced it.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import type { CalendarDate } from "../src/core/calendar/pcalendar.ts";
import { getLiturgicalDay } from "../src/engine/index.ts";
import { getOrderedLiturgyReadings } from "../src/engine/orderedLiturgy.ts";
import { getOrderedMatinsReadings } from "../src/engine/orderedMatins.ts";
import { getDailyReadings } from "../src/engine/readings.ts";
import type { ReadingRef } from "../src/engine/readings.ts";
import {
	compareCommemorations,
	compareReadings,
	readingRefMatchesCitation,
} from "../scripts/analysis/comparators.ts";
import type { HtocCorpus } from "../scripts/analysis/corpus.ts";

// ---------- keystone days ----------

interface Keystone {
	readonly label: string;
	readonly civil: CalendarDate;
	readonly cId: string;
	readonly commemNameFragment: string;
	readonly liturgyApostol: string;
	readonly liturgyGospel: string;
	readonly festalGospel: string;
}

const KEYSTONES: readonly Keystone[] = [
	{
		label: "Pascha 2025",
		civil: { year: 2025, month: 4, day: 20 },
		cId: "9001",
		commemNameFragment: "Pascha",
		liturgyApostol: "Acts 1:1-8",
		liturgyGospel: "John 1:1-17",
		// Pascha has no Matins gospel; HTOC lists John 20:19-25 as the
		// Vespers gospel.
		festalGospel: "John 20:19-25",
	},
	{
		label: "Theophany 2025",
		civil: { year: 2025, month: 1, day: 19 },
		cId: "163",
		commemNameFragment: "Theophany",
		liturgyApostol: "Titus 2:11-14; 3:4-7",
		liturgyGospel: "Matthew 3:13-17",
		festalGospel: "Mark 1:9-11",
	},
	{
		label: "Transfiguration 2025",
		civil: { year: 2025, month: 8, day: 19 },
		cId: "4386",
		commemNameFragment: "Transfiguration",
		liturgyApostol: "II Peter 1:10-19",
		liturgyGospel: "Matthew 17:1-9",
		festalGospel: "Luke 9:28-36",
	},
	{
		label: "Dormition 2025",
		civil: { year: 2025, month: 8, day: 28 },
		cId: "4444",
		commemNameFragment: "Dormition",
		liturgyApostol: "Philippians 2:5-11",
		liturgyGospel: "Luke 10:38-42; 11:27-28",
		festalGospel: "Luke 1:39-49, 56",
	},
	{
		label: "Nativity 2026",
		civil: { year: 2026, month: 1, day: 7 },
		cId: "3174",
		commemNameFragment: "Nativity",
		liturgyApostol: "Galatians 4:4-7",
		liturgyGospel: "Matthew 2:1-12",
		festalGospel: "Matthew 1:18-25",
	},
];

function findRef(
	bag: readonly ReadingRef[],
	citation: string,
): ReadingRef | undefined {
	return bag.find((r) => readingRefMatchesCitation(r, citation));
}

/**
 * Collect every reading the engine knows about for `cal` — ordered lists plus
 * suppressed lists plus every service — deduplicated on the SCRIPTURE tuple.
 * Ordering bugs still get caught by `HTOC corpus budgets`; the keystone tests
 * focus on "does the engine emit the correct reference *anywhere*".
 */
function allEngineReadings(cal: CalendarDate): ReadingRef[] {
	const bag: ReadingRef[] = [];
	const lit = getOrderedLiturgyReadings(cal);
	for (const r of lit.apostol) bag.push(r);
	for (const r of lit.gospel) bag.push(r);
	for (const r of lit.suppressed) bag.push(r);
	const matins = getOrderedMatinsReadings(cal);
	for (const r of matins.refs) bag.push(r);
	for (const r of matins.suppressed) bag.push(r);
	for (const service of [
		"liturgy",
		"matins",
		"vespers",
		"primes",
		"terce",
		"sexte",
		"none",
	] as const) {
		for (const r of getDailyReadings(cal, { service }).refs) bag.push(r);
	}
	const seen = new Set<string>();
	const out: ReadingRef[] = [];
	for (const r of bag) {
		const k = `${r.cId}|${r.type}|${r.service}|${r.reading}`;
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(r);
	}
	return out;
}

describe("HTOC keystones", () => {
	for (const k of KEYSTONES) {
		describe(k.label, () => {
			test(`emits commemoration cId=${k.cId} matching "${k.commemNameFragment}"`, () => {
				const day = getLiturgicalDay(k.civil);
				const saint = day.allSaints.find((s) => s.cId === k.cId);
				assert.ok(
					saint !== undefined,
					`expected saint cId=${k.cId} in day.allSaints; got [${day.allSaints
						.map((s) => s.cId)
						.join(", ")}]`,
				);
				const names = [
					saint.name?.nominative,
					saint.name?.short,
					saint.name?.long,
				]
					.filter((v): v is string => typeof v === "string")
					.join(" ")
					.toLowerCase();
				assert.ok(
					names.includes(k.commemNameFragment.toLowerCase()),
					`expected name to contain "${k.commemNameFragment}", got "${names}"`,
				);
			});

			test("engine knows the HTOC Liturgy apostol", () => {
				const bag = allEngineReadings(k.civil);
				const hit = findRef(bag, k.liturgyApostol);
				assert.ok(
					hit !== undefined,
					`expected "${k.liturgyApostol}" among engine readings; got [${bag
						.map((r) => `${r.type}/${r.service}:${r.reading}`)
						.join(", ")}]`,
				);
			});

			test("engine knows the HTOC Liturgy gospel", () => {
				const bag = allEngineReadings(k.civil);
				const hit = findRef(bag, k.liturgyGospel);
				assert.ok(
					hit !== undefined,
					`expected "${k.liturgyGospel}" among engine readings; got [${bag
						.map((r) => `${r.type}/${r.service}:${r.reading}`)
						.join(", ")}]`,
				);
			});

			test("engine knows the HTOC festal gospel (Matins or Vespers)", () => {
				const bag = allEngineReadings(k.civil);
				const hit = findRef(bag, k.festalGospel);
				assert.ok(
					hit !== undefined,
					`expected festal gospel "${k.festalGospel}" among engine readings; got [${bag
						.map((r) => `${r.type}/${r.service}:${r.reading}`)
						.join(", ")}]`,
				);
			});
		});
	}
});

// ---------- corpus-wide budgets ----------

const HERE = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES_DIR = resolve(HERE, "fixtures");
const CORPUS_YEARS = [2025, 2026, 2027] as const;
const CORPUS_PATHS = CORPUS_YEARS.map((y) =>
	resolve(FIXTURES_DIR, `htoc-full-${y}.json`),
);
const CORPUS_PRESENT = CORPUS_PATHS.every((p) => existsSync(p));

// Budgets — these are the current baseline minus a small slack. Improve
// the engine to nudge these upward; do not relax them without justification.
// Measured 2026-<HTOC daily-lectionary override landed> on 1095 days.
const BUDGET = {
	commemorationCoveragePct: 34.5, // measured: 35.6%
	readingCoveragePct: 97.5, // measured: 97.93% (up from 88.8% pre-htoc-saint-lectionary, 83.4% pre-htoc-daily-lectionary)
	toneMatchPctOfBothPresent: 100.0, // measured: 100% when both non-null
	perDayReadingHtocOnlyMaxAvg: 0.1, // measured: 85/1095 ≈ 0.078 (was 0.417 pre-htoc-saint-lectionary)
} as const;

function collectEngineReadings(cal: CalendarDate): ReadingRef[] {
	const bag: ReadingRef[] = [];
	const lit = getOrderedLiturgyReadings(cal);
	for (const r of lit.apostol) bag.push(r);
	for (const r of lit.gospel) bag.push(r);
	const matins = getOrderedMatinsReadings(cal);
	for (const r of matins.refs) bag.push(r);
	for (const r of matins.suppressed) bag.push(r);
	for (const service of [
		"vespers",
		"primes",
		"terce",
		"sexte",
		"none",
	] as const) {
		for (const r of getDailyReadings(cal, { service }).refs) bag.push(r);
	}
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

function isoToCal(iso: string): CalendarDate {
	const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
	return { year: y!, month: m!, day: d! };
}

describe("HTOC corpus budgets", { skip: !CORPUS_PRESENT }, async () => {
	// Read fixtures once and share aggregates between tests.
	const { readFileSync } = await import("node:fs");
	const corpora = CORPUS_PATHS.map(
		(p) => JSON.parse(readFileSync(p, "utf8")) as HtocCorpus,
	);
	let days = 0;
	let commMatched = 0;
	let commHtocOnly = 0;
	let readMatched = 0;
	let readHtocOnly = 0;
	let readEngineOnly = 0;
	let toneBothPresent = 0;
	let toneMismatch = 0;
	let engineFailures = 0;
	for (const c of corpora) {
		for (const iso of Object.keys(c.days)) {
			const htoc = c.days[iso]!;
			const cal = isoToCal(iso);
			try {
				const day = getLiturgicalDay(cal);
				const readings = collectEngineReadings(cal);
				const commRes = compareCommemorations(
					htoc.commemorations,
					day.allSaints,
				);
				const readRes = compareReadings(htoc.scripture, readings);
				commMatched += commRes.matched.length;
				commHtocOnly += commRes.htocOnly.length;
				readMatched += readRes.matched;
				readHtocOnly += readRes.htocOnly.length;
				readEngineOnly += readRes.engineOnly.length;
				if (htoc.tone !== null && day.tone !== null) {
					toneBothPresent++;
					if (htoc.tone !== day.tone) toneMismatch++;
				}
				days++;
			} catch {
				engineFailures++;
			}
		}
	}

	test("engine handles every day without throwing", () => {
		assert.equal(
			engineFailures,
			0,
			`${engineFailures} days threw; expected 0`,
		);
	});

	test(`commemoration coverage ≥ ${BUDGET.commemorationCoveragePct}%`, () => {
		const denom = commMatched + commHtocOnly;
		assert.ok(denom > 0, "expected at least one commemoration observation");
		const pct = (commMatched / denom) * 100;
		assert.ok(
			pct >= BUDGET.commemorationCoveragePct,
			`coverage ${pct.toFixed(2)}% < budget ${BUDGET.commemorationCoveragePct}%; commMatched=${commMatched}, commHtocOnly=${commHtocOnly}`,
		);
	});

	test(`reading coverage ≥ ${BUDGET.readingCoveragePct}%`, () => {
		const denom = readMatched + readHtocOnly;
		assert.ok(denom > 0, "expected at least one reading observation");
		const pct = (readMatched / denom) * 100;
		assert.ok(
			pct >= BUDGET.readingCoveragePct,
			`coverage ${pct.toFixed(2)}% < budget ${BUDGET.readingCoveragePct}%; readMatched=${readMatched}, readHtocOnly=${readHtocOnly}`,
		);
	});

	test(`tone matches on 100% of days where both sides emit a tone (mismatch budget ≤ 0)`, () => {
		assert.equal(
			toneMismatch,
			0,
			`${toneMismatch} tone mismatches (of ${toneBothPresent} days with both tones set)`,
		);
	});

	test(`avg per-day HTOC-only readings ≤ ${BUDGET.perDayReadingHtocOnlyMaxAvg}`, () => {
		const avg = readHtocOnly / days;
		assert.ok(
			avg <= BUDGET.perDayReadingHtocOnlyMaxAvg,
			`avg ${avg.toFixed(3)} > budget ${BUDGET.perDayReadingHtocOnlyMaxAvg}; readHtocOnly=${readHtocOnly}, days=${days}`,
		);
	});

	test("engine-only readings and processed-day count are non-zero (smoke)", () => {
		assert.ok(days >= 1000, `expected ≥1000 processed days, got ${days}`);
		assert.ok(
			readEngineOnly > 0,
			"expected engine-only readings (Vespers/Hours HTOC omits); got 0",
		);
	});
});
