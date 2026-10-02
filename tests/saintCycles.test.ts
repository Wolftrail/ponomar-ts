// Tests for the HTOC saint cycle tables (any-year lookup via Julian MM-DD
// menaion + Pascha-offset pentecostarion + per-ISO exceptions).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
	SAINTS_BY_ISO,
	SAINT_EXCEPTIONS,
	SAINT_FIXED_CYCLE,
	SAINT_MOVABLE_CYCLE,
	getSaintsFor,
	getSaintsForAnyYear,
} from "../src/engine/saints.ts";

describe("HTOC saint cycle tables (shape)", () => {
	test("fixed cycle has 364 Julian MM-DD keys", () => {
		assert.equal(SAINT_FIXED_CYCLE.size, 364);
	});

	test("movable cycle has 21 Pascha-offset keys", () => {
		assert.equal(SAINT_MOVABLE_CYCLE.size, 21);
	});

	test("exceptions cover a small number of in-window days", () => {
		// 42 observed in current data; tolerate growth so the test doesn't
		// become brittle on data refreshes but still flags unexpected drift.
		assert.ok(
			SAINT_EXCEPTIONS.size > 0 && SAINT_EXCEPTIONS.size < 100,
			`expected a handful of exception days, got ${SAINT_EXCEPTIONS.size}`,
		);
	});

	test("fixed cycle bucket for Julian Dec-25 (Nativity Old Style) contains a rank='6' saint", () => {
		const entries = SAINT_FIXED_CYCLE.get("12-25");
		assert.ok(entries, "expected Dec-25 Julian bucket to exist");
		const nativity = entries.find((e) => e.rank === "6");
		assert.ok(nativity, "expected a rank='6' Great Feast on Julian Dec-25");
		assert.match(nativity.text, /Nativity/i);
	});

	test("movable cycle covers both Lenten (negative) and Paschal (positive) offsets", () => {
		const offsets = [...SAINT_MOVABLE_CYCLE.keys()];
		assert.ok(
			offsets.some((o) => o < 0),
			"expected at least one pre-Pascha (negative offset) entry",
		);
		assert.ok(
			offsets.some((o) => o > 0),
			"expected at least one post-Pascha (positive offset) entry",
		);
	});

	test("movable cycle offset -14 (Lazarus Saturday eve / Palm Sunday prep) exists", () => {
		// `Epiphany/p-14` is Palm Sunday's commemoration cluster per HTOC.
		const entries = SAINT_MOVABLE_CYCLE.get(-14);
		assert.ok(entries && entries.length > 0, "expected offset -14 bucket");
	});
});

describe("getSaintsForAnyYear (in-window matches SAINTS_BY_ISO)", () => {
	test("every vendored ISO date returns the exact scraped list", () => {
		for (const [iso, want] of SAINTS_BY_ISO) {
			const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
			const got = getSaintsForAnyYear({ year: y, month: m, day: d });
			assert.strictEqual(got, want, `mismatch for ${iso}`);
		}
	});
});

describe("getSaintsForAnyYear (out-of-window cycle synthesis)", () => {
	test("Jan 7 2030 (Nativity) returns the Great Feast", () => {
		const saints = getSaintsForAnyYear({ year: 2030, month: 1, day: 7 });
		const nativity = saints.find((s) => s.rank === "6");
		assert.ok(nativity, "expected Nativity rank='6' on Jan 7 2030");
		assert.match(nativity.text, /Nativity/i);
	});

	test("Jan 19 2030 (Theophany) returns the Great Feast", () => {
		const saints = getSaintsForAnyYear({ year: 2030, month: 1, day: 19 });
		const theophany = saints.find((s) => s.rank === "6");
		assert.ok(theophany, "expected Theophany rank='6' on Jan 19 2030");
		assert.match(theophany.text, /Theophany|Baptism/i);
	});

	test("Myrrhbearers Sunday 2024 (May 19, Pascha + 14) returns movable-cycle entries", () => {
		// Orthodox Pascha 2024 was May 5 (Gregorian); +14 days = May 19.
		const saints = getSaintsForAnyYear({ year: 2024, month: 5, day: 19 });
		const movable = saints.filter((s) => s.cycle === "movable");
		assert.ok(
			movable.length >= 2,
			`expected ≥2 movable entries on Pascha+14, got ${movable.length}`,
		);
		assert.ok(
			movable.some((s) => s.slug === "Epiphany/p+14"),
			"expected Epiphany/p+14 slug",
		);
	});

	test("Jan 7 2050 (Nativity, 25 years out) still returns the Great Feast", () => {
		const saints = getSaintsForAnyYear({ year: 2050, month: 1, day: 7 });
		assert.ok(
			saints.find((s) => s.rank === "6" && /Nativity/i.test(s.text)),
			"Nativity should remain stable in the fixed cycle for any future year",
		);
	});

	test("Jan 15 2030 (ordinary weekday) returns a non-empty saint list", () => {
		const saints = getSaintsForAnyYear({ year: 2030, month: 1, day: 15 });
		assert.ok(saints.length > 0, "every Julian day carries at least one saint");
	});
});

describe("getSaintsFor (window-only; unchanged behavior)", () => {
	test("still returns null outside 2025-2027", () => {
		assert.equal(getSaintsFor({ year: 2030, month: 5, day: 15 }), null);
	});
});
