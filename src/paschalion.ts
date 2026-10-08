// Ported from Ponomar/Paschalion.java (typiconman/ponomar).
// Differences: the experimental Metonic lunar-phase methods are not ported here; see the astronomy module.

import { addDays, difference, julianDate, type JulianDate } from "./core/calendar/jdate.ts";

export type { JulianDate } from "./core/calendar/jdate.ts";

function assertYear(year: number): void {
	if (!Number.isInteger(year) || year < 33) {
		throw new RangeError("year must be an integer greater than or equal to 33");
	}
}

/** Upstream's mod: the remainder of `value / modulo`, with a zero remainder mapped to `modulo`. */
function mod(value: number, modulo: number): number {
	const remainder = value % modulo;
	return remainder === 0 ? modulo : remainder;
}

/** Julian-calendar date of Pascha by the Gaussian formula. */
export function getPascha(year: number): JulianDate {
	assertYear(year);
	const a = year % 4;
	const b = year % 7;
	const c = year % 19;
	const d = (19 * c + 15) % 30;
	const e = (2 * a + 4 * b - d + 34) % 7;
	const ordinal = d + e + 114;
	return julianDate(year, Math.floor(ordinal / 31), (ordinal % 31) + 1);
}

export function getPentecost(year: number): JulianDate {
	return addDays(getPascha(year), 49);
}

/** Clean Monday. */
export function getLentStart(year: number): JulianDate {
	return addDays(getPascha(year), -48);
}

/** Monday after the Sunday of All Saints. */
export function getApostlesFastStart(year: number): JulianDate {
	return addDays(getPascha(year), 57);
}

/** Days from the start of the Apostles' Fast to 29 June; negative when Pascha is very late. */
export function getApostlesFastLength(year: number): number {
	return difference(julianDate(year, 6, 29), getApostlesFastStart(year));
}

/** The "key of boundaries" letter of the visual Paschalion, with Az = 1. */
export function getKeyOfBoundaries(year: number): number {
	const pascha = getPascha(year);
	return pascha.month === 3 ? pascha.day - 21 : pascha.day + 10;
}

/** Negative before year 312, as upstream. */
export function getIndiction(year: number): number {
	assertYear(year);
	return mod(year - 312, 15);
}

export function getSolarCycle(year: number): number {
	assertYear(year);
	return mod(year + 5508, 28);
}

export function getLunarCycle(year: number): number {
	assertYear(year);
	const cycle = ((year + 1) % 19) - 3;
	return cycle <= 0 ? cycle + 19 : cycle;
}
