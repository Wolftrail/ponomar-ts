// Ported from Ponomar/PCalendar.java (typiconman/ponomar).
// Differences: functions over plain year/month/day triples; no JDate validation of Gregorian input.

import { julianDateFromJdn, type JulianDate } from "./jdate.ts";

export type CalendarType = "julian" | "gregorian";

export interface CalendarDate {
	readonly year: number;
	readonly month: number;
	readonly day: number;
}

/** Fractional Julian Day (noon-based, so midnight dates end in .5). Gregorian rules apply only after 14 Oct 1582. */
export function julianDay(date: CalendarDate, type: CalendarType): number {
	let y = date.year;
	let m = date.month;
	const d = date.day;
	if (m < 3) {
		m += 12;
		y -= 1;
	}
	const a = Math.trunc(y / 100);
	let b = 0;
	if (type === "gregorian" && (y > 1582 || (y === 1582 && m > 10) || (y === 1582 && m === 10 && d > 14))) {
		b = 2 - a + Math.floor(a / 4);
	}
	return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
}

/** Days by which the Gregorian calendar leads the Julian for the same year/month/day fields. */
export function calendarDifference(date: CalendarDate): number {
	return julianDay(date, "julian") - julianDay(date, "gregorian");
}

export function getAnnoMundi(date: CalendarDate, type: CalendarType): number {
	const difference = type === "gregorian" ? calendarDifference(date) : 0;
	const cutoff = julianDay({ year: date.year, month: 9, day: 1 }, "julian");
	let am = 5508 - Math.floor(difference / 365) + date.year;
	if (julianDay(date, type) >= cutoff) {
		am += 1;
	}
	return am;
}

export function getJulianCalendarDate(date: CalendarDate, type: CalendarType): CalendarDate {
	const z = Math.trunc(julianDay(date, type) + 0.5);
	return fromAlmostJulianDay(z);
}

/** Dates before 15 Oct 1582 come back on the Julian calendar. */
export function getGregorianCalendarDate(date: CalendarDate, type: CalendarType): CalendarDate {
	const z = Math.trunc(julianDay(date, type) + 0.5);
	let a = z;
	if (z > 2299161) {
		const alpha = Math.trunc((z - 1867216.25) / 36524.25);
		a = z + 1 + alpha - Math.trunc(alpha / 4);
	}
	return fromAlmostJulianDay(a);
}

export function toGregorian(date: CalendarDate): CalendarDate {
	return getGregorianCalendarDate(date, "julian");
}

export function fromGregorian(date: CalendarDate): JulianDate {
	return julianDateFromJdn(julianDay(date, "gregorian") + 0.5);
}

function fromAlmostJulianDay(a: number): CalendarDate {
	const b = a + 1524;
	const c = Math.trunc((b - 122.1) / 365.25);
	const d = Math.trunc(365.25 * c);
	const e = Math.trunc((b - d) / 30.6001);
	const month = e < 14 ? e - 1 : e - 13;
	return {
		year: month > 2 ? c - 4716 : c - 4715,
		month,
		day: b - d - Math.trunc(30.6001 * e),
	};
}
