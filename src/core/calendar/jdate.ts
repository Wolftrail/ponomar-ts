// Ported from Ponomar/JDate.java (typiconman/ponomar).
// The upstream Java class is a mutable Julian-calendar date backed by a
// Julian Day Number (JDN). This TS port is an immutable value object with the
// same JDN as the source of truth, plus pre-computed Y/M/D fields.
//
// Notes on differences vs upstream:
//   * All operations return new values (no mutation).
//   * `dayOfYear` matches upstream's zero-indexed convention (Jan 1 == 0).
//   * `difference(a, b) = a.jdn - b.jdn` matches upstream's static method
//     `JDate.difference(former, latter)`.

import type { CalendarDate } from "./pcalendar.ts";

/** A calendar date on the Julian calendar plus its Julian Day Number. */
export interface JulianDate {
	readonly year: number;
	readonly month: number;
	readonly day: number;
	readonly jdn: number;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const DAYS_IN_MONTH_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const MONTH_DOY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334] as const;
const MONTH_DOY_LEAP = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335] as const;

/** Julian calendar leap year rule: every year divisible by 4. */
export function isJulianLeapYear(year: number): boolean {
	return year % 4 === 0;
}

/** Maximum day number for a (Julian-calendar) month/year combination. */
export function daysInMonth(year: number, month: number): number {
	if (!Number.isInteger(month) || month < 1 || month > 12) {
		throw new RangeError(`month must be 1..12, got ${month}`);
	}
	const table = isJulianLeapYear(year) ? DAYS_IN_MONTH_LEAP : DAYS_IN_MONTH;
	return table[month - 1]!;
}

function assertValid(year: number, month: number, day: number): void {
	if (!Number.isInteger(year) || year < 1) {
		throw new RangeError(`year must be a positive integer, got ${year}`);
	}
	if (!Number.isInteger(month) || month < 1 || month > 12) {
		throw new RangeError(`month must be 1..12, got ${month}`);
	}
	if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) {
		throw new RangeError(
			`day must be 1..${daysInMonth(year, month)} for ${year}-${month}, got ${day}`,
		);
	}
}

/**
 * Build a `JulianDate` from Julian-calendar year/month/day. Throws
 * `RangeError` if any field is out of range for the calendar.
 */
export function julianDate(year: number, month: number, day: number): JulianDate {
	assertValid(year, month, day);
	return { year, month, day, jdn: julianYmdToJdn(year, month, day) };
}

/** Build a `JulianDate` from its Julian Day Number. */
export function julianDateFromJdn(jdn: number): JulianDate {
	if (!Number.isInteger(jdn) || jdn < 0) {
		throw new RangeError(`jdn must be a non-negative integer, got ${jdn}`);
	}
	const { year, month, day } = jdnToJulianYmd(jdn);
	return { year, month, day, jdn };
}

/** Add `n` days (may be negative); returns a new `JulianDate`. */
export function addDays(date: JulianDate, n: number): JulianDate {
	if (!Number.isInteger(n)) {
		throw new RangeError(`n must be an integer, got ${n}`);
	}
	return julianDateFromJdn(date.jdn + n);
}

/** Subtract `n` days (may be negative); returns a new `JulianDate`. */
export function subtractDays(date: JulianDate, n: number): JulianDate {
	return addDays(date, -n);
}

/**
 * Signed difference in days between two dates: `a.jdn - b.jdn`. Matches
 * upstream `JDate.difference(former, latter)`.
 */
export function difference(a: JulianDate, b: JulianDate): number {
	return a.jdn - b.jdn;
}

/** Day of week where Sunday = 0, Monday = 1, ... Saturday = 6. */
export function dayOfWeek(date: JulianDate): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
	// JDN 0 was a Monday; (jdn + 1) mod 7 yields Sunday-first index.
	return ((date.jdn + 1) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Zero-indexed day of year on the Julian calendar (Jan 1 == 0). Matches
 * upstream `JDate.getDoy()`.
 */
export function dayOfYear(date: JulianDate): number {
	const table = isJulianLeapYear(date.year) ? MONTH_DOY_LEAP : MONTH_DOY;
	return table[date.month - 1]! + date.day - 1;
}

export function equals(a: JulianDate, b: JulianDate): boolean {
	return a.jdn === b.jdn;
}

export function compare(a: JulianDate, b: JulianDate): number {
	return a.jdn - b.jdn;
}

/**
 * Convert a Julian-calendar date to the proleptic Gregorian calendar via
 * Julian Day Number.
 */
export function toGregorian(date: JulianDate): CalendarDate {
	return jdnToGregorianYmd(date.jdn);
}

/** Convert a proleptic Gregorian date to a Julian-calendar `JulianDate`. */
export function fromGregorian(date: CalendarDate): JulianDate {
	return julianDateFromJdn(gregorianYmdToJdn(date.year, date.month, date.day));
}

// ---------------------------------------------------------------------------
// Low-level JDN conversions (Meeus / Fliegel-van Flandern style, integer only)

function julianYmdToJdn(year: number, month: number, day: number): number {
	const a = Math.floor((14 - month) / 12);
	const y = year + 4800 - a;
	const m = month + 12 * a - 3;
	return (
		day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083
	);
}

function jdnToJulianYmd(jdn: number): {
	year: number;
	month: number;
	day: number;
} {
	const c = jdn + 32082;
	const d = Math.floor((4 * c + 3) / 1461);
	const e = c - Math.floor((1461 * d) / 4);
	const m = Math.floor((5 * e + 2) / 153);
	const day = e - Math.floor((153 * m + 2) / 5) + 1;
	const month = m + 3 - 12 * Math.floor(m / 10);
	const year = d - 4800 + Math.floor(m / 10);
	return { year, month, day };
}

function gregorianYmdToJdn(year: number, month: number, day: number): number {
	const a = Math.floor((14 - month) / 12);
	const y = year + 4800 - a;
	const m = month + 12 * a - 3;
	return (
		day +
		Math.floor((153 * m + 2) / 5) +
		365 * y +
		Math.floor(y / 4) -
		Math.floor(y / 100) +
		Math.floor(y / 400) -
		32045
	);
}

function jdnToGregorianYmd(jdn: number): CalendarDate {
	const a = jdn + 32044;
	const b = Math.floor((4 * a + 3) / 146097);
	const c = a - Math.floor((146097 * b) / 4);
	const d = Math.floor((4 * c + 3) / 1461);
	const e = c - Math.floor((1461 * d) / 4);
	const m = Math.floor((5 * e + 2) / 153);
	const day = e - Math.floor((153 * m + 2) / 5) + 1;
	const month = m + 3 - 12 * Math.floor(m / 10);
	const year = 100 * b + d - 4800 + Math.floor(m / 10);
	return { year, month, day };
}

// Internal accessors reused by pcalendar.ts to avoid duplicating conversion
// logic. Kept `internal` in name to signal they are not part of the stable
// public API.
export const _internal = {
	gregorianYmdToJdn,
	jdnToGregorianYmd,
} as const;
