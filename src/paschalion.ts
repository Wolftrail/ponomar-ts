// Ported from Ponomar/Paschalion.java (typiconman/ponomar).
// The upstream implementation uses Gauss' formula for the Julian Pascha date;
// this file mirrors that logic, then converts to the Gregorian calendar via a
// year-dependent Julian offset (13 days for 1900-2099, 14 days for 2100-2199,
// etc).

/** A proleptic Gregorian calendar date (all fields 1-based). */
export interface CalendarDate {
	readonly year: number;
	readonly month: number;
	readonly day: number;
}

/**
 * Julian calendar date of Orthodox Pascha for the given AD year, computed by
 * Gauss' Easter formula (the "Meeus / Butcher / Anonymous Gregorian" family,
 * restricted to the Julian branch).
 *
 * @throws {RangeError} if `year` is not a positive integer.
 */
export function getJulianPascha(year: number): CalendarDate {
	if (!Number.isInteger(year) || year < 1) {
		throw new RangeError(`year must be a positive integer, got ${year}`);
	}
	const a = year % 19;
	const b = year % 4;
	const c = year % 7;
	const d = (19 * a + 15) % 30;
	const e = (2 * b + 4 * c + 6 * d + 6) % 7;
	const f = d + e;
	if (f <= 9) return { year, month: 3, day: 22 + f };
	return { year, month: 4, day: f - 9 };
}

/**
 * Gregorian calendar offset (in days) that must be *added* to a Julian date
 * to obtain the same civil day on the Gregorian calendar, for the given AD
 * year. Follows the standard rule: every non-leap Gregorian century adds one
 * day. Correct from 1583 (introduction of the Gregorian reform in Catholic
 * Europe) forward.
 */
export function julianToGregorianOffset(year: number): number {
	if (!Number.isInteger(year) || year < 1583) {
		throw new RangeError(
			`Gregorian conversion is only defined from 1583 onward, got ${year}`,
		);
	}
	// Standard rule: every non-leap Gregorian century adds one day to the
	// Julian-Gregorian offset. Equivalently:
	//   offset = floor(Y/100) - floor(Y/400) - 2
	return Math.floor(year / 100) - Math.floor(year / 400) - 2;
}

/**
 * Gregorian civil date of Orthodox Pascha for the given AD year.
 */
export function getOrthodoxPascha(year: number): CalendarDate {
	const jd = getJulianPascha(year);
	return addDays(jd, julianToGregorianOffset(year));
}

/** Add `n` days to a calendar date. Handles month/year boundaries. */
export function addDays(date: CalendarDate, n: number): CalendarDate {
	const utcMs = Date.UTC(date.year, date.month - 1, date.day) + n * 86_400_000;
	const d = new Date(utcMs);
	return {
		year: d.getUTCFullYear(),
		month: d.getUTCMonth() + 1,
		day: d.getUTCDate(),
	};
}
