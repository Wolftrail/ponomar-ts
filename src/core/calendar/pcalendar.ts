// Proleptic Gregorian calendar utilities. The Gregorian date shape and its
// small helper set live here so that `paschalion.ts` and `core/calendar/jdate.ts`
// can share one definition of `CalendarDate` and one JDN-based conversion path.

import { _internal } from "./jdate.ts";

/** A proleptic Gregorian calendar date (all fields 1-based). */
export interface CalendarDate {
	readonly year: number;
	readonly month: number;
	readonly day: number;
}

/**
 * Gregorian calendar offset (in days) that must be *added* to a Julian date
 * to obtain the same civil day on the Gregorian calendar, for the given AD
 * year. Every non-leap Gregorian century adds one day. Correct from 1583
 * (Gregorian reform) forward.
 */
export function julianToGregorianOffset(year: number): number {
	if (!Number.isInteger(year) || year < 1583) {
		throw new RangeError(
			`Gregorian conversion is only defined from 1583 onward, got ${year}`,
		);
	}
	return Math.floor(year / 100) - Math.floor(year / 400) - 2;
}

/**
 * Add `n` days to a Gregorian calendar date. Handles month/year boundaries.
 * `n` may be negative.
 */
export function addDays(date: CalendarDate, n: number): CalendarDate {
	if (!Number.isInteger(n)) {
		throw new RangeError(`n must be an integer, got ${n}`);
	}
	const jdn = _internal.gregorianYmdToJdn(date.year, date.month, date.day);
	return _internal.jdnToGregorianYmd(jdn + n);
}

/** Signed difference in days between two Gregorian dates (`a - b`). */
export function difference(a: CalendarDate, b: CalendarDate): number {
	return (
		_internal.gregorianYmdToJdn(a.year, a.month, a.day) -
		_internal.gregorianYmdToJdn(b.year, b.month, b.day)
	);
}
