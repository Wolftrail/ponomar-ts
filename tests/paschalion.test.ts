import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	addDays,
	getApostlesFastStart,
	getAscension,
	getCheesefare,
	getJulianPascha,
	getJulianPaschaRich,
	getLentStart,
	getMeatfare,
	getOrthodoxPascha,
	getPentecost,
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

const MOVEABLE_FEAST_FIXTURES = [
	{
		year: 2020,
		meatfare: { year: 2020, month: 2, day: 23 },
		cheesefare: { year: 2020, month: 3, day: 1 },
		lent: { year: 2020, month: 3, day: 2 },
		pascha: { year: 2020, month: 4, day: 19 },
		ascension: { year: 2020, month: 5, day: 28 },
		pentecost: { year: 2020, month: 6, day: 7 },
		apostles: { year: 2020, month: 6, day: 15 },
	},
	{
		year: 2026,
		meatfare: { year: 2026, month: 2, day: 15 },
		cheesefare: { year: 2026, month: 2, day: 22 },
		lent: { year: 2026, month: 2, day: 23 },
		pascha: { year: 2026, month: 4, day: 12 },
		ascension: { year: 2026, month: 5, day: 21 },
		pentecost: { year: 2026, month: 5, day: 31 },
		apostles: { year: 2026, month: 6, day: 8 },
	},
] as const;

describe("moveable feasts", () => {
	for (const f of MOVEABLE_FEAST_FIXTURES) {
		it(`${f.year}: derived feasts match`, () => {
			assert.deepEqual(getMeatfare(f.year), f.meatfare);
			assert.deepEqual(getCheesefare(f.year), f.cheesefare);
			assert.deepEqual(getLentStart(f.year), f.lent);
			assert.deepEqual(getOrthodoxPascha(f.year), f.pascha);
			assert.deepEqual(getAscension(f.year), f.ascension);
			assert.deepEqual(getPentecost(f.year), f.pentecost);
			assert.deepEqual(getApostlesFastStart(f.year), f.apostles);
		});
	}
});

describe("getJulianPaschaRich", () => {
	it("returns Julian Y/M/D matching getJulianPascha, plus a JDN", () => {
		const plain = getJulianPascha(2020);
		const rich = getJulianPaschaRich(2020);
		assert.equal(rich.year, plain.year);
		assert.equal(rich.month, plain.month);
		assert.equal(rich.day, plain.day);
		assert.equal(typeof rich.jdn, "number");
		assert.equal(Number.isInteger(rich.jdn), true);
	});
});
