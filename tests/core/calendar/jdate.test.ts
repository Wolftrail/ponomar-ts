import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	addDays,
	compare,
	dayOfWeek,
	dayOfYear,
	daysInMonth,
	difference,
	equals,
	fromGregorian,
	isJulianLeapYear,
	julianDate,
	julianDateFromJdn,
	subtractDays,
	toGregorian,
} from "../../../src/core/calendar/jdate.ts";

describe("isJulianLeapYear", () => {
	it("is true for years divisible by 4 including centuries", () => {
		assert.equal(isJulianLeapYear(2020), true);
		assert.equal(isJulianLeapYear(2100), true);
		assert.equal(isJulianLeapYear(1900), true);
	});
	it("is false otherwise", () => {
		assert.equal(isJulianLeapYear(2021), false);
		assert.equal(isJulianLeapYear(1999), false);
	});
});

describe("daysInMonth", () => {
	it("returns 29 for Julian February in a leap year", () => {
		assert.equal(daysInMonth(2020, 2), 29);
	});
	it("returns 28 for Julian February otherwise", () => {
		assert.equal(daysInMonth(2021, 2), 28);
	});
	it("throws on invalid month", () => {
		assert.throws(() => daysInMonth(2020, 13), RangeError);
		assert.throws(() => daysInMonth(2020, 0), RangeError);
	});
});

describe("julianDate + JDN roundtrip", () => {
	// Julian Jan 1 2000 == Gregorian Jan 14 2000 == JDN 2451558.
	it("Julian 2000-01-01 has JDN 2451558", () => {
		const d = julianDate(2000, 1, 1);
		assert.equal(d.jdn, 2451558);
	});

	it("round-trips Y/M/D through JDN", () => {
		const cases: ReadonlyArray<[number, number, number]> = [
			[33, 1, 1],
			[1000, 6, 15],
			[1900, 2, 29],
			[2000, 12, 31],
			[2026, 3, 30],
		];
		for (const [y, m, d] of cases) {
			const jd = julianDate(y, m, d);
			const back = julianDateFromJdn(jd.jdn);
			assert.deepEqual(
				{ year: back.year, month: back.month, day: back.day },
				{ year: y, month: m, day: d },
			);
		}
	});

	it("rejects out-of-range values", () => {
		assert.throws(() => julianDate(2020, 0, 1), RangeError);
		assert.throws(() => julianDate(2020, 2, 30), RangeError);
		assert.throws(() => julianDate(2021, 2, 29), RangeError);
		assert.throws(() => julianDate(0, 1, 1), RangeError);
	});
});

describe("addDays / subtractDays / difference", () => {
	it("adds within a month", () => {
		const d = addDays(julianDate(2020, 3, 15), 10);
		assert.deepEqual(
			{ year: d.year, month: d.month, day: d.day },
			{ year: 2020, month: 3, day: 25 },
		);
	});
	it("crosses month and year boundaries", () => {
		const d = addDays(julianDate(2020, 12, 31), 1);
		assert.deepEqual(
			{ year: d.year, month: d.month, day: d.day },
			{ year: 2021, month: 1, day: 1 },
		);
	});
	it("subtractDays is inverse of addDays", () => {
		const start = julianDate(2020, 4, 6);
		const roundtrip = subtractDays(addDays(start, 49), 49);
		assert.equal(equals(start, roundtrip), true);
	});
	it("difference is signed", () => {
		const pascha = julianDate(2020, 4, 6);
		const pentecost = addDays(pascha, 49);
		assert.equal(difference(pentecost, pascha), 49);
		assert.equal(difference(pascha, pentecost), -49);
	});
});

describe("dayOfWeek", () => {
	// Pascha 2020: Julian Apr 6 == Gregorian Apr 19 == Sunday.
	it("Pascha 2020 (Julian Apr 6) is Sunday", () => {
		assert.equal(dayOfWeek(julianDate(2020, 4, 6)), 0);
	});
	it("Julian 2020-04-05 is Saturday", () => {
		assert.equal(dayOfWeek(julianDate(2020, 4, 5)), 6);
	});
	// Sunday + 5 days == Friday.
	it("Julian 2020-04-11 is Friday", () => {
		assert.equal(dayOfWeek(julianDate(2020, 4, 11)), 5);
	});
});

describe("dayOfYear", () => {
	it("Jan 1 == 0, zero-indexed to match upstream", () => {
		assert.equal(dayOfYear(julianDate(2020, 1, 1)), 0);
	});
	it("Jan 6 == 5", () => {
		assert.equal(dayOfYear(julianDate(2021, 1, 6)), 5);
		assert.equal(dayOfYear(julianDate(2020, 1, 6)), 5);
	});
	it("Feb 29 in a Julian leap year == 59", () => {
		assert.equal(dayOfYear(julianDate(2020, 2, 29)), 59);
	});
	it("Dec 25 == 358 non-leap and 359 leap", () => {
		assert.equal(dayOfYear(julianDate(2021, 12, 25)), 358);
		assert.equal(dayOfYear(julianDate(2020, 12, 25)), 359);
	});
});

describe("Julian to Gregorian conversion", () => {
	it("Julian 2020-04-06 is Gregorian 2020-04-19", () => {
		assert.deepEqual(toGregorian(julianDate(2020, 4, 6)), {
			year: 2020,
			month: 4,
			day: 19,
		});
	});
	it("Julian 2100-03-01 is Gregorian 2100-03-15", () => {
		assert.deepEqual(toGregorian(julianDate(2100, 3, 1)), {
			year: 2100,
			month: 3,
			day: 15,
		});
	});
	it("Gregorian 2020-04-19 is Julian 2020-04-06", () => {
		const j = fromGregorian({ year: 2020, month: 4, day: 19 });
		assert.deepEqual(
			{ year: j.year, month: j.month, day: j.day },
			{ year: 2020, month: 4, day: 6 },
		);
	});
	it("round-trips for a spread of years", () => {
		for (const year of [1600, 1800, 1900, 2000, 2024, 2100, 2500]) {
			const j = julianDate(year, 3, 15);
			const back = fromGregorian(toGregorian(j));
			assert.equal(equals(j, back), true);
		}
	});
});

describe("equals / compare", () => {
	it("equal dates compare as 0", () => {
		const a = julianDate(2020, 4, 6);
		const b = julianDate(2020, 4, 6);
		assert.equal(equals(a, b), true);
		assert.equal(compare(a, b), 0);
	});
	it("earlier is less than later", () => {
		const a = julianDate(2020, 4, 6);
		const b = julianDate(2020, 4, 7);
		assert.equal(compare(a, b) < 0, true);
		assert.equal(compare(b, a) > 0, true);
	});
});
