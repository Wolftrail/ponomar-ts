// Tests for src/engine/matinsGospel.ts — the resurrectional Matins Gospel
// 11-cycle. Uses synthesized `DayContext` values so the algorithm can be
// exercised deterministically without leaning on Julian-date arithmetic.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { DayContext } from "../src/engine/day.ts";
import {
	RESURRECTION_MATINS_GOSPELS,
	getResurrectionMatinsGospel,
} from "../src/engine/matinsGospel.ts";
import { computeDayContext } from "../src/engine/day.ts";

/** Build a synthetic DayContext with just the fields the algorithm reads. */
function ctx(dow: number, nday: number, ndayP: number): DayContext {
	return {
		gregorian: { year: 2000, month: 1, day: 1 },
		julian: { year: 2000, month: 1, day: 1, jdn: 0 },
		doy: 0,
		dow,
		nday,
		ndayP,
		ndayF: 0,
	};
}

/** ndayP such that `(ndayP / 7 - 7) % 11 === n` for `n` in 1..10, and
 *  `n === 11` when the mod result is 0. Picks a "second cycle" (k=1) so
 *  raw > 11 for n=1..10 and raw = 11 for n=11. */
function ndayPForGospel(n: number): number {
	if (n === 11) return 7 * (7 + 11);
	return 7 * (7 + 11 + n);
}

describe("RESURRECTION_MATINS_GOSPELS", () => {
	test("has exactly 11 entries numbered 1..11", () => {
		assert.equal(RESURRECTION_MATINS_GOSPELS.length, 11);
		for (let i = 0; i < 11; i++) {
			assert.equal(RESURRECTION_MATINS_GOSPELS[i]!.number, i + 1);
		}
	});

	test("readings match the canonical pericope table", () => {
		const expected = [
			"Mt_28:16-20",
			"Mk_16:1-8",
			"Mk_16:9-20",
			"Lk_24:1-12",
			"Lk_24:12-35",
			"Lk_24:36-53",
			"Jn_20:1-10",
			"Jn_20:11-18",
			"Jn_20:19-31",
			"Jn_21:1-14",
			"Jn_21:15-25",
		];
		for (let i = 0; i < 11; i++) {
			assert.equal(RESURRECTION_MATINS_GOSPELS[i]!.reading, expected[i]);
		}
	});

	test("each entry parses to a well-formed BibleRef", () => {
		for (const g of RESURRECTION_MATINS_GOSPELS) {
			assert.ok(g.ref.book.length > 0);
			assert.ok(g.ref.chapter > 0);
			assert.ok(g.ref.ranges.length > 0);
		}
	});
});

describe("getResurrectionMatinsGospel — cycle formula", () => {
	test("each cycle position 1..11 returns the correct gospel", () => {
		for (let n = 1; n <= 11; n++) {
			const result = getResurrectionMatinsGospel(
				ctx(0, 100, ndayPForGospel(n)),
			);
			assert.notEqual(result, null);
			assert.equal(result!.number, n);
			assert.equal(result!.reading, RESURRECTION_MATINS_GOSPELS[n - 1]!.reading);
		}
	});

	test("12 consecutive Sundays cycle 1→11→1 with correct wraparound", () => {
		// Start at a Sunday where formula yields gospel #1.
		const baseP = ndayPForGospel(1);
		const seq: number[] = [];
		for (let week = 0; week < 12; week++) {
			const g = getResurrectionMatinsGospel(ctx(0, 100, baseP + 7 * week));
			assert.notEqual(g, null);
			seq.push(g!.number);
		}
		assert.deepEqual(seq, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 1]);
	});

	test("mod=0 wraps to gospel #11 (not #0)", () => {
		// ndayP = 49 → raw = 7 - 7 = 0 → mod = 0 → n = 11.
		const g = getResurrectionMatinsGospel(ctx(0, 100, 49));
		assert.equal(g?.number, 11);
	});

	test("cycle applies through Great Lent (negative nday, Sunday)", () => {
		// nday = -30 is a Great Lent Sunday; cycle must still fire.
		const g = getResurrectionMatinsGospel(
			ctx(0, -30, ndayPForGospel(4)),
		);
		assert.equal(g?.number, 4);
	});
});

describe("getResurrectionMatinsGospel — skip rules", () => {
	test("non-Sunday (dow !== 0) returns null", () => {
		for (let dow = 1; dow <= 6; dow++) {
			assert.equal(
				getResurrectionMatinsGospel(ctx(dow, 100, ndayPForGospel(1))),
				null,
			);
		}
	});

	test("Pascha Sunday (nday == 0) returns null", () => {
		assert.equal(
			getResurrectionMatinsGospel(ctx(0, 0, ndayPForGospel(1))),
			null,
		);
	});

	test("Pentecost Sunday (nday == 49) returns null", () => {
		assert.equal(
			getResurrectionMatinsGospel(ctx(0, 49, ndayPForGospel(1))),
			null,
		);
	});

	test("Sunday just before All Saints edge (nday == 55) returns null", () => {
		assert.equal(
			getResurrectionMatinsGospel(ctx(0, 55, ndayPForGospel(1))),
			null,
		);
	});

	test("All Saints Sunday (nday == 56) — cycle applies again", () => {
		const g = getResurrectionMatinsGospel(ctx(0, 56, ndayPForGospel(2)));
		assert.equal(g?.number, 2);
	});

	test("dRank === 6 (Great Feast of the Theotokos) returns null", () => {
		assert.equal(
			getResurrectionMatinsGospel(ctx(0, 100, ndayPForGospel(1)), 6),
			null,
		);
	});

	test("dRank === 7 (Great Feast of the Lord) — cycle still applies", () => {
		// Per Fekula §1F3 and Ponomar's `dRank != 6` guard: the Great Feast
		// of the Lord does NOT displace the resurrection matins gospel;
		// downstream ordering handles the actual displacement decision.
		const g = getResurrectionMatinsGospel(ctx(0, 100, ndayPForGospel(1)), 7);
		assert.equal(g?.number, 1);
	});

	test("dRank === 5 (polyeleos) — cycle applies", () => {
		const g = getResurrectionMatinsGospel(ctx(0, 100, ndayPForGospel(3)), 5);
		assert.equal(g?.number, 3);
	});
});

describe("getResurrectionMatinsGospel — end-to-end with computeDayContext", () => {
	test("2025-06-15 Gregorian (Sunday of All Saints) yields a valid cycle gospel", () => {
		const day = computeDayContext({ year: 2025, month: 6, day: 15 });
		assert.equal(day.dow, 0);
		assert.ok(day.nday >= 56);
		const g = getResurrectionMatinsGospel(day);
		assert.notEqual(g, null);
		assert.ok(g!.number >= 1 && g!.number <= 11);
	});
});
