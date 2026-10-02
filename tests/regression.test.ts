// HTOC regression suite. Compares the engine's output to
// holytrinityorthodox.com's reference data across two axes:
//
//   1. **Keystone-day exact assertions.** For Pascha, Nativity, Theophany,
//      Transfiguration, and Dormition we hard-code the HTOC Liturgy
//      apostol, Liturgy gospel, and festal Matins gospel. These run
//      unconditionally — they don't need the scraped corpus on disk.
//
//   2. **Corpus-wide budgets.** When the `tests/fixtures/full-*.json`
//      files are present (they're gitignored), we run the full vendored
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
import { getReadings } from "../src/engine/readings.ts";
import { getOrderedLiturgyReadings } from "../src/engine/orderedLiturgy.ts";
import { getOrderedMatinsReadings } from "../src/engine/orderedMatins.ts";
import { getDailyReadings } from "../src/engine/readings.ts";
import type { ReadingRef } from "../src/engine/readings.ts";
import {
	compareCommemorations,
	compareReadings,
	readingRefMatchesCitation,
} from "../scripts/analysis/comparators.ts";
import type { Corpus } from "../scripts/analysis/corpus.ts";

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
				// Keystones key off Ponomar's XML cIds (numeric), which live on
				// the structural lists; `day.allSaints` is now HTOC-sourced and
				// carries synthetic `htoc:` cIds instead.
				const structural = [...day.paschalSaints, ...day.menaionSaints];
				const saint = structural.find((s) => s.cId === k.cId);
				assert.ok(
					saint !== undefined,
					`expected saint cId=${k.cId} in structural lists; got [${structural
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

describe("HTOC daily-lectionary eviction", () => {
	test("Thu 2026-10-01: HTOC's Mt_24:13-28 evicts Ponomar sequential Mk_11:27-33", () => {
		const ord = getOrderedLiturgyReadings({ year: 2026, month: 10, day: 1 });
		const gospels = ord.gospel.map((r) => r.reading);
		assert.deepEqual(
			gospels,
			["Mt_24:13-28"],
			`expected only HTOC's Mt_24:13-28; got [${gospels.join(", ")}]`,
		);
		assert.equal(ord.gospel[0]?.source, "htoc");
	});

	test("Fri 2025-02-14: both HTOC pairs survive — Ponomar sequential I Jn+Mk kept because HTOC also lists them", () => {
		const ord = getOrderedLiturgyReadings({ year: 2025, month: 2, day: 14 });
		const apostol = ord.apostol.map((r) => r.reading).sort();
		const gospel = ord.gospel.map((r) => r.reading).sort();
		assert.ok(
			apostol.includes("I Jn_2:7-17") && apostol.includes("II Tim_3:1-9"),
			`expected both apostol pairs; got [${apostol.join(", ")}]`,
		);
		assert.ok(
			gospel.includes("Mk_14:3-9") && gospel.includes("Lk_20:46-21:4"),
			`expected both gospel pairs; got [${gospel.join(", ")}]`,
		);
	});

	test("Sun 2026-09-27 (Exaltation of the Cross): verse-part suffix dedup — HTOC Jn_19:6-11... doesn't duplicate menaion Jn_19:6-11a...", () => {
		const ord = getOrderedLiturgyReadings({ year: 2026, month: 9, day: 27 });
		assert.equal(
			ord.gospel.length,
			1,
			`expected single festal gospel; got [${ord.gospel.map((r) => r.reading).join(", ")}]`,
		);
		assert.equal(
			ord.apostol.length,
			1,
			`expected single festal apostol; got [${ord.apostol.map((r) => r.reading).join(", ")}]`,
		);
		assert.ok(ord.gospel[0]?.reading.startsWith("Jn_19:"));
		assert.equal(ord.apostol[0]?.reading, "I Cor_1:18-24");
	});

	test("Sun 2026-09-27 (Exaltation): festal matins gospel displaces the resurrection cycle gospel", () => {
		// Universal Exaltation of the Cross — the festal menaion matins
		// gospel (type="1" Jn 12:28-36) must displace the Sunday-cycle
		// resurrection matins gospel (Mk 16:1-8).
		const matins = getDailyReadings(
			{ year: 2026, month: 9, day: 27 },
			{ service: "matins" },
		).refs;
		const gospels = matins.filter(
			(r) => r.reading.startsWith("Jn_12:28-36") || r.reading.startsWith("Mk_16:"),
		);
		assert.equal(
			gospels.length,
			1,
			`expected exactly one matins gospel (festal Jn 12:28-36); got [${gospels
				.map((r) => `${r.type}:${r.reading} (${r.source})`)
				.join(", ")}]`,
		);
		assert.ok(gospels[0]?.reading.startsWith("Jn_12:28-36"));
		assert.notEqual(gospels[0]?.source, "cycle");
	});
});

describe("getReadings", () => {
	test("Thu 2026-10-01: returns exactly HTOC's 2 published refs", () => {
		const refs = getReadings({ year: 2026, month: 10, day: 1 });
		assert.equal(refs.length, 2);
		const liturgy = refs.filter((r) => r.service === "liturgy");
		assert.equal(liturgy.length, 2);
		assert.ok(liturgy.some((r) => r.reading === "Eph_5:33-6:9" && r.type === "apostol"));
		assert.ok(liturgy.some((r) => r.reading === "Mt_24:13-28" && r.type === "gospel"));
	});

	test("Sun 2026-09-27 (Universal Exaltation): festal matins + liturgy pair, no resurrection cycle", () => {
		const refs = getReadings({ year: 2026, month: 9, day: 27 });
		assert.ok(refs.some((r) => r.service === "matins" && r.reading.startsWith("Jn_12:28-36")));
		assert.ok(refs.some((r) => r.service === "liturgy" && r.reading === "I Cor_1:18-24"));
		assert.ok(
			refs.some(
				(r) =>
					r.service === "liturgy" && r.reading.startsWith("Jn_19:6-11") &&
					r.reading.includes("30"),
			),
		);
		// Resurrection cycle (Mk 16:1-8 etc.) must not appear.
		assert.ok(!refs.some((r) => r.service === "matins" && r.reading.startsWith("Mk_16:")));
	});

	test("Fri 2026-04-10 (Great Friday): all 12 Passion Gospels + Royal Hours + Vesperal Liturgy", () => {
		const refs = getReadings({ year: 2026, month: 4, day: 10 });
		const matinsGospels = refs.filter((r) => r.service === "matins");
		assert.equal(matinsGospels.length, 12);
		for (const hour of ["prime", "third", "sixth", "ninth"] as const) {
			const atHour: readonly ReadingRef[] = refs.filter((r) => r.hour === hour);
			assert.equal(atHour.length, 2, `Royal Hour ${hour} should have 2 refs`);
		}
		const liturgy = refs.filter((r) => r.service === "liturgy");
		assert.equal(liturgy.length, 6, "Vesperal Liturgy: 1 apostol + 5 gospels");
	});

	test("Dates outside the vendored window still return algorithmic refs", () => {
		// 2033 and 2024 have no HTOC fixtures — the Ponomar engine still
		// computes a daily rjadovoje liturgy pair + matins gospel on Sunday.
		const future = getReadings({ year: 2033, month: 1, day: 1 });
		const past = getReadings({ year: 2024, month: 12, day: 31 });
		for (const refs of [future, past]) {
			const liturgy = refs.filter((r) => r.service === "liturgy");
			assert.ok(
				liturgy.length >= 2,
				`expected at least liturgy apostol+gospel, got ${liturgy.length}`,
			);
			assert.ok(liturgy.some((r) => r.type === "apostol"));
			assert.ok(liturgy.some((r) => r.type === "gospel"));
		}
	});
});

// ---------- corpus-wide budgets ----------

const HERE = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES_DIR = resolve(HERE, "fixtures");
const CORPUS_YEARS = [2025, 2026, 2027, 2028, 2029, 2030] as const;
const CORPUS_PATHS = CORPUS_YEARS.map((y) =>
	resolve(FIXTURES_DIR, `full-${y}.json`),
);
const CORPUS_PRESENT = CORPUS_PATHS.every((p) => existsSync(p));

// Budgets — these are the current baseline minus a small slack. Improve
// the engine to nudge these upward; do not relax them without justification.
// Measured on the 2025–2030 vendored corpus after `allSaints` was reseated
// on HTOC's own commemoration list (synthetic cIds + HTOC rank glyph).
const BUDGET = {
	commemorationCoveragePct: 100.0, // measured: 100% (allSaints is HTOC-sourced)
	readingCoveragePct: 99.5, // measured: 100% (up from 97.9% pre-eviction-fix, 88.8% pre-saint-lectionary, 83.4% pre-daily-lectionary)
	toneMatchPctOfBothPresent: 100.0, // measured: 100% when both non-null
	perDayReadingOnlyMaxAvg: 0.02, // measured: 0 across the vendored corpus (was 0.08 pre-eviction-fix, 0.42 pre-saint-lectionary)
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
		(p) => JSON.parse(readFileSync(p, "utf8")) as Corpus,
	);
	let days = 0;
	let commMatched = 0;
	let commOnly = 0;
	let readMatched = 0;
	let readOnly = 0;
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
				commOnly += commRes.only.length;
				readMatched += readRes.matched;
				readOnly += readRes.only.length;
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
		const denom = commMatched + commOnly;
		assert.ok(denom > 0, "expected at least one commemoration observation");
		const pct = (commMatched / denom) * 100;
		assert.ok(
			pct >= BUDGET.commemorationCoveragePct,
			`coverage ${pct.toFixed(2)}% < budget ${BUDGET.commemorationCoveragePct}%; commMatched=${commMatched}, commOnly=${commOnly}`,
		);
	});

	test(`reading coverage ≥ ${BUDGET.readingCoveragePct}%`, () => {
		const denom = readMatched + readOnly;
		assert.ok(denom > 0, "expected at least one reading observation");
		const pct = (readMatched / denom) * 100;
		assert.ok(
			pct >= BUDGET.readingCoveragePct,
			`coverage ${pct.toFixed(2)}% < budget ${BUDGET.readingCoveragePct}%; readMatched=${readMatched}, readOnly=${readOnly}`,
		);
	});

	test(`tone matches on 100% of days where both sides emit a tone (mismatch budget ≤ 0)`, () => {
		assert.equal(
			toneMismatch,
			0,
			`${toneMismatch} tone mismatches (of ${toneBothPresent} days with both tones set)`,
		);
	});

	test(`avg per-day HTOC-only readings ≤ ${BUDGET.perDayReadingOnlyMaxAvg}`, () => {
		const avg = readOnly / days;
		assert.ok(
			avg <= BUDGET.perDayReadingOnlyMaxAvg,
			`avg ${avg.toFixed(3)} > budget ${BUDGET.perDayReadingOnlyMaxAvg}; readOnly=${readOnly}, days=${days}`,
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
