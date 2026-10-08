import assert from "node:assert/strict";
import test from "node:test";
import {
	addDays,
	dayOfWeek,
	dayOfYear,
	difference,
	julianDate,
	julianDateFromJdn,
	type JulianDate,
} from "../../../src/core/calendar/jdate.ts";
import { loadFullGolden, loadGolden, type GoldenRow } from "../../helpers/golden.ts";

function checkRow(row: GoldenRow): void {
	const date: JulianDate = julianDateFromJdn(Number(row["jdn"]));
	assert.deepEqual(
		[date.year, date.month, date.day, dayOfWeek(date), dayOfYear(date)],
		[Number(row["year"]), Number(row["month"]), Number(row["day"]), Number(row["dow"]), Number(row["doy"])],
		`jdn ${row["jdn"]}`,
	);
	assert.equal(julianDate(date.year, date.month, date.day).jdn, date.jdn);
}

test("matches upstream JDate on sampled days", () => {
	for (const row of loadGolden("jdate")) {
		checkRow(row);
	}
});

const full = loadFullGolden("jdate");
test("matches upstream JDate on every day from 33 to 3000", { skip: full === undefined }, () => {
	for (const row of full!) {
		checkRow(row);
	}
});

test("doy is non-leap based with 29 February as 366", () => {
	assert.equal(dayOfYear(julianDate(2024, 1, 1)), 0);
	assert.equal(dayOfYear(julianDate(2024, 2, 28)), 58);
	assert.equal(dayOfYear(julianDate(2024, 2, 29)), 366);
	assert.equal(dayOfYear(julianDate(2024, 3, 1)), 59);
	assert.equal(dayOfYear(julianDate(2023, 12, 31)), 364);
});

test("day arithmetic crosses month and year boundaries", () => {
	const start = julianDate(2026, 12, 30);
	const later = addDays(start, 3);
	assert.deepEqual([later.year, later.month, later.day], [2027, 1, 2]);
	assert.equal(difference(later, start), 3);
	assert.equal(addDays(later, -3).jdn, start.jdn);
});

test("rejects invalid dates", () => {
	assert.throws(() => julianDate(2023, 2, 29), RangeError);
	assert.throws(() => julianDate(2024, 13, 1), RangeError);
	assert.throws(() => julianDate(2024, 4, 0), RangeError);
	assert.throws(() => julianDate(2024.5, 4, 1), RangeError);
	assert.throws(() => julianDateFromJdn(-1), RangeError);
});
