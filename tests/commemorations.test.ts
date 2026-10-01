import test from "node:test";
import { strict as assert } from "node:assert";

import { HTOC_DAY_FACTS_BY_ISO } from "../src/data/htocDayFacts.ts";
import { computeDayContext } from "../src/engine/day.ts";
import {
	getCommemorationsForAnyYear,
	getFixedCommemorations,
	getSeasonCommemorations,
} from "../src/engine/commemorations.ts";
import { HTOC_FIXED_COMMEMORATIONS_CYCLE } from "../src/data/htocFixedCommemorations.ts";

function ctxFor(iso: string) {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	return computeDayContext({ year: y, month: m, day: d });
}

test("fixed cycle: all 365 Julian keys present", () => {
	assert.equal(HTOC_FIXED_COMMEMORATIONS_CYCLE.size, 365);
});

test("fixed lookup: Julian Jan 1 (Gregorian Jan 14) — Basil the Great", () => {
	// 2025-01-14 is Julian Jan 1.
	const ctx = ctxFor("2025-01-14");
	assert.equal(ctx.julian.month, 1);
	assert.equal(ctx.julian.day, 1);
	const fixed = getFixedCommemorations(ctx);
	assert.ok(fixed.length > 0, "Jan 1 Julian must have fixed entries");
	assert.ok(
		fixed.some((c) => /Basil the Great/i.test(c.text)),
		"Jan 1 Julian must include Basil the Great",
	);
});

test("season markers: Clean Monday", () => {
	// 2025: Pascha = April 20 Gregorian → Clean Monday = March 3.
	const ctx = ctxFor("2025-03-03");
	const season = getSeasonCommemorations(ctx);
	assert.ok(
		season.some((c) => c.text === "Clean Monday."),
		"Clean Monday marker must be emitted",
	);
});

test("season markers: Dormition Fast begins Julian Aug 1", () => {
	// Gregorian Aug 14 is Julian Aug 1 in all three years.
	for (const iso of ["2025-08-14", "2026-08-14", "2027-08-14"]) {
		const season = getSeasonCommemorations(ctxFor(iso));
		assert.ok(
			season.some((c) => c.text === "Beginning of the Dormition Fast ."),
			`Dormition Fast marker must be emitted on ${iso}`,
		);
	}
});

test("season markers: Nativity Fast begins Julian Nov 15", () => {
	// Gregorian Nov 28 is Julian Nov 15 in all three years.
	for (const iso of ["2025-11-28", "2026-11-28", "2027-11-28"]) {
		const season = getSeasonCommemorations(ctxFor(iso));
		assert.ok(
			season.some((c) => c.text === "Beginning of Nativity Fast."),
			`Nativity Fast marker must be emitted on ${iso}`,
		);
	}
});

test("season markers: Apostles' Fast begins Monday after All Saints (nday=57)", () => {
	for (const iso of ["2025-06-16", "2026-06-08", "2027-06-28"]) {
		const ctx = ctxFor(iso);
		assert.equal(ctx.nday, 57, `${iso} must be nday=57`);
		const season = getSeasonCommemorations(ctx);
		assert.ok(
			season.some((c) => c.text === "Beginning of Apostles' (Peter & Paul) Fast"),
			`Apostles' Fast marker must be emitted on ${iso}`,
		);
	}
});

test("season markers: Sviatki marker only on Nativity (Julian Dec 25)", () => {
	// On Nativity itself.
	for (const iso of ["2025-01-07", "2026-01-07", "2027-01-07"]) {
		const season = getSeasonCommemorations(ctxFor(iso));
		assert.ok(
			season.some((c) => c.text.includes("Fast-free period (Sviatki)")),
			`Sviatki marker must be emitted on Nativity ${iso}`,
		);
	}
	// NOT on subsequent Sviatki days.
	for (const iso of ["2025-01-08", "2025-01-10", "2025-01-14", "2025-01-17"]) {
		const season = getSeasonCommemorations(ctxFor(iso));
		assert.ok(
			!season.some((c) => c.text.includes("Fast-free period (Sviatki)")),
			`Sviatki marker must NOT be emitted on ${iso}`,
		);
	}
});

test("coverage: ≥82% perfect-match days vs 1095 vendored", () => {
	let perfect = 0;
	const keyOf = (c: { rank: string; text: string; minor: boolean }) =>
		`${c.rank}|${c.minor ? 1 : 0}|${c.text}`;
	for (const [iso, facts] of HTOC_DAY_FACTS_BY_ISO) {
		const got = getCommemorationsForAnyYear(ctxFor(iso));
		const exp = new Set(facts.commemorations.map(keyOf));
		const gotSet = new Set(got.map(keyOf));
		if (exp.size !== gotSet.size) continue;
		let match = true;
		for (const k of exp) if (!gotSet.has(k)) { match = false; break; }
		if (match) perfect++;
	}
	assert.ok(
		perfect >= Math.floor(1095 * 0.82),
		`Expected ≥82% perfect-match days, got ${perfect}/1095 (${((perfect / 1095) * 100).toFixed(1)}%)`,
	);
});

test("coverage: ≥98% commemoration-entry recall vs 1095 vendored", () => {
	let expected = 0;
	let correct = 0;
	const keyOf = (c: { rank: string; text: string; minor: boolean }) =>
		`${c.rank}|${c.minor ? 1 : 0}|${c.text}`;
	for (const [iso, facts] of HTOC_DAY_FACTS_BY_ISO) {
		const got = new Set(getCommemorationsForAnyYear(ctxFor(iso)).map(keyOf));
		for (const c of facts.commemorations) {
			expected++;
			if (got.has(keyOf(c))) correct++;
		}
	}
	const pct = (correct / expected) * 100;
	assert.ok(
		pct >= 98,
		`Expected ≥98% recall, got ${correct}/${expected} (${pct.toFixed(1)}%)`,
	);
});

test("coverage: ≤2 extra entries across 1095 vendored days", () => {
	let extras = 0;
	const keyOf = (c: { rank: string; text: string; minor: boolean }) =>
		`${c.rank}|${c.minor ? 1 : 0}|${c.text}`;
	for (const [iso, facts] of HTOC_DAY_FACTS_BY_ISO) {
		const exp = new Set(facts.commemorations.map(keyOf));
		for (const c of getCommemorationsForAnyYear(ctxFor(iso))) {
			if (!exp.has(keyOf(c))) extras++;
		}
	}
	assert.ok(extras <= 2, `Expected ≤2 extras, got ${extras}`);
});

test("future year: 2030 Julian Jan 1 returns Basil the Great (any year works)", () => {
	// 2030-01-14 is Julian Jan 1 (same 13-day gap).
	const ctx = computeDayContext({ year: 2030, month: 1, day: 14 });
	assert.equal(ctx.julian.month, 1);
	assert.equal(ctx.julian.day, 1);
	const fixed = getFixedCommemorations(ctx);
	assert.ok(
		fixed.some((c) => /Basil the Great/i.test(c.text)),
		"fixed-Julian table must work for any year",
	);
});
