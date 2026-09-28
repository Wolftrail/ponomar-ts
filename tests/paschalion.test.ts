import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	addDays,
	getJulianPascha,
	getOrthodoxPascha,
	julianToGregorianOffset,
} from "../src/paschalion.ts";

// Authoritative Julian-calendar Pascha dates cross-checked against published
// Orthodox paschalions and Ponomar's Perl regression fixtures.
const JULIAN_PASCHA_FIXTURES: ReadonlyArray<[number, number, number]> = [
	[2020, 4, 6],
	[2021, 4, 19],
	[2022, 4, 11],
	[2023, 4, 3],
	[2024, 4, 22],
	[2025, 4, 7],
	[2026, 3, 30],
	[2027, 4, 19],
	[2028, 4, 3],
];

// Authoritative Gregorian civil dates of Orthodox Pascha (13-day offset in
// the 20th–21st centuries).
const GREGORIAN_PASCHA_FIXTURES: ReadonlyArray<[number, number, number]> = [
	[2020, 4, 19],
	[2021, 5, 2],
	[2022, 4, 24],
	[2023, 4, 16],
	[2024, 5, 5],
	[2025, 4, 20],
	[2026, 4, 12],
	[2027, 5, 2],
	[2028, 4, 16],
];

describe("getJulianPascha", () => {
	for (const [year, month, day] of JULIAN_PASCHA_FIXTURES) {
		it(`returns Julian ${year}-${month}-${day}`, () => {
			assert.deepEqual(getJulianPascha(year), { year, month, day });
		});
	}

	it("rejects non-positive years", () => {
		assert.throws(() => getJulianPascha(0), RangeError);
		assert.throws(() => getJulianPascha(-1), RangeError);
		assert.throws(() => getJulianPascha(2024.5), RangeError);
	});
});

describe("julianToGregorianOffset", () => {
	it("is 13 days for 1900-2099", () => {
		assert.equal(julianToGregorianOffset(1900), 13);
		assert.equal(julianToGregorianOffset(2000), 13);
		assert.equal(julianToGregorianOffset(2099), 13);
	});

	it("is 14 days for 2100-2199", () => {
		assert.equal(julianToGregorianOffset(2100), 14);
	});

	it("rejects years before the Gregorian reform", () => {
		assert.throws(() => julianToGregorianOffset(1582), RangeError);
	});
});

describe("getOrthodoxPascha", () => {
	for (const [year, month, day] of GREGORIAN_PASCHA_FIXTURES) {
		it(`returns Gregorian ${year}-${month}-${day}`, () => {
			assert.deepEqual(getOrthodoxPascha(year), { year, month, day });
		});
	}
});

describe("addDays", () => {
	it("adds within a month", () => {
		assert.deepEqual(addDays({ year: 2026, month: 4, day: 19 }, 7), {
			year: 2026,
			month: 4,
			day: 26,
		});
	});

	it("crosses month boundaries", () => {
		assert.deepEqual(addDays({ year: 2026, month: 4, day: 28 }, 5), {
			year: 2026,
			month: 5,
			day: 3,
		});
	});

	it("crosses year boundaries", () => {
		assert.deepEqual(addDays({ year: 2026, month: 12, day: 30 }, 3), {
			year: 2027,
			month: 1,
			day: 2,
		});
	});

	it("supports negative offsets", () => {
		assert.deepEqual(addDays({ year: 2026, month: 1, day: 3 }, -5), {
			year: 2025,
			month: 12,
			day: 29,
		});
	});
});
