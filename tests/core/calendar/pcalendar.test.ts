import assert from "node:assert/strict";
import test from "node:test";
import {
	fromGregorian,
	getAnnoMundi,
	getGregorianCalendarDate,
	getJulianCalendarDate,
	julianDay,
	toGregorian,
	type CalendarType,
} from "../../../src/core/calendar/pcalendar.ts";
import { loadGolden } from "../../helpers/golden.ts";

test("matches upstream PCalendar", () => {
	for (const row of loadGolden("pcalendar")) {
		const type = row["calendar"] as CalendarType;
		const date = { year: Number(row["year"]), month: Number(row["month"]), day: Number(row["day"]) };
		const label = `${type} ${date.year}-${date.month}-${date.day}`;
		assert.equal(julianDay(date, type), Number(row["julianDay"]), label);
		assert.equal(getAnnoMundi(date, type), Number(row["am"]), label);
		assert.deepEqual(
			getJulianCalendarDate(date, type),
			{ year: Number(row["yearJ"]), month: Number(row["monthJ"]), day: Number(row["dayJ"]) },
			label,
		);
		assert.deepEqual(
			getGregorianCalendarDate(date, type),
			{ year: Number(row["yearG"]), month: Number(row["monthG"]), day: Number(row["dayG"]) },
			label,
		);
	}
});

test("converts between Julian and Gregorian dates", () => {
	assert.deepEqual(toGregorian({ year: 2026, month: 3, day: 30 }), { year: 2026, month: 4, day: 12 });
	const julian = fromGregorian({ year: 2026, month: 4, day: 12 });
	assert.deepEqual([julian.year, julian.month, julian.day], [2026, 3, 30]);
	assert.deepEqual(toGregorian({ year: 1900, month: 2, day: 29 }), { year: 1900, month: 3, day: 13 });
});
