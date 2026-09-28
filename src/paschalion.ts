// Ported from Ponomar/Paschalion.java (typiconman/ponomar).
// Uses Gauss' formula for the Julian Pascha date, then converts to the
// Gregorian civil calendar via Julian Day Number (see src/core/calendar/).

import {
	addDays as addDaysJulian,
	julianDate,
	toGregorian,
	type JulianDate,
} from "./core/calendar/jdate.ts";
import type { CalendarDate } from "./core/calendar/pcalendar.ts";

export type { CalendarDate } from "./core/calendar/pcalendar.ts";
export {
	addDays,
	julianToGregorianOffset,
} from "./core/calendar/pcalendar.ts";

/**
 * Julian calendar date of Orthodox Pascha for the given AD year, computed by
 * Gauss' Easter formula. The returned month/day are on the *Julian* calendar.
 *
 * @throws {RangeError} if `year` is not a positive integer.
 */
export function getJulianPascha(year: number): CalendarDate {
	const rich = getJulianPaschaRich(year);
	return { year: rich.year, month: rich.month, day: rich.day };
}

/** Gregorian civil date of Orthodox Pascha for the given AD year. */
export function getOrthodoxPascha(year: number): CalendarDate {
	return toGregorian(getJulianPaschaRich(year));
}

/** Pentecost (Pascha + 49 days), Gregorian civil date. */
export function getPentecost(year: number): CalendarDate {
	return toGregorian(addDaysJulian(getJulianPaschaRich(year), 49));
}

/** Ascension (Pascha + 39 days), Gregorian civil date. */
export function getAscension(year: number): CalendarDate {
	return toGregorian(addDaysJulian(getJulianPaschaRich(year), 39));
}

/** Meatfare Sunday (Pascha - 56 days), Gregorian civil date. */
export function getMeatfare(year: number): CalendarDate {
	return toGregorian(addDaysJulian(getJulianPaschaRich(year), -56));
}

/** Cheesefare / Forgiveness Sunday (Pascha - 49 days), Gregorian. */
export function getCheesefare(year: number): CalendarDate {
	return toGregorian(addDaysJulian(getJulianPaschaRich(year), -49));
}

/** Clean Monday, start of Great Lent (Pascha - 48 days), Gregorian. */
export function getLentStart(year: number): CalendarDate {
	return toGregorian(addDaysJulian(getJulianPaschaRich(year), -48));
}

/** Apostles' Fast start (Pascha + 57 days), Gregorian. */
export function getApostlesFastStart(year: number): CalendarDate {
	return toGregorian(addDaysJulian(getJulianPaschaRich(year), 57));
}

/**
 * Julian-calendar date of Pascha as a rich `JulianDate` (with pre-computed
 * Julian Day Number). Used by the engine layer for `nday` derivations.
 */
export function getJulianPaschaRich(year: number): JulianDate {
	if (!Number.isInteger(year) || year < 1) {
		throw new RangeError(`year must be a positive integer, got ${year}`);
	}
	const a = year % 19;
	const b = year % 4;
	const c = year % 7;
	const d = (19 * a + 15) % 30;
	const e = (2 * b + 4 * c + 6 * d + 6) % 7;
	const f = d + e;
	return f <= 9 ? julianDate(year, 3, 22 + f) : julianDate(year, 4, f - 9);
}
