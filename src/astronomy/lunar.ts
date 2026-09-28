// Ported from lunar-phase paths in Ponomar/Paschalion.java. The phase is
// computed **not astronomically** but on the Metonic cycle — sufficient for
// liturgical purposes and identical to upstream. Marked "experimental" by
// upstream; guarantees are as-is.

import type { JulianDate } from "../core/calendar/jdate.ts";
import { julianDate, julianDateFromJdn } from "../core/calendar/jdate.ts";

/** Mean synodic month, in days. Upstream constant. */
export const LUNAR_MONTH = 29.52916667;

/** Half a lunar "day" — the window around each cardinal phase within
 *  which {@link getLunarPhaseName} rounds to that phase. */
export const LUNAR_HALF_DAY = 0.016932411;

/** Age of the moon (days since new moon) on 1 March Julian for each of the
 *  19 years of the Metonic cycle. Index 0 → cycle 1, …, index 18 → cycle 19. */
const FOUNDATION: readonly number[] = [
	14.042016807, 25.462184874, 6.084033613, 17.966386555, 28.336134454,
	9.210084034, 20.504201681, 1.420168067, 12.294117647, 23.168067227,
	4.546218487, 15.042016807, 26.294117647, 7.630252101, 18.546218487,
	29.420168067, 11.756302521, 26.210084034, 3.042016807,
];

/** Names for the eight cardinal lunar phases. */
export type LunarPhaseName =
	| "new"
	| "waxing-crescent"
	| "first-quarter"
	| "waxing-gibbous"
	| "full"
	| "waning-gibbous"
	| "last-quarter"
	| "waning-crescent";

/** Metonic-cycle index (1..19) for a Julian-calendar year (AD 33 or later). */
export function getLunarCycle(year: number): number {
	if (!Number.isInteger(year) || year < 33) {
		throw new RangeError(`year must be an integer >= 33, got ${year}`);
	}
	let t = (year + 1) % 19 - 3;
	if (t <= 0) t += 19;
	return t;
}

/** Phase of the moon on `date`, as a fraction of the lunar month.
 *  0 = new moon, 0.5 = full, wraps at 1. */
export function getLunarPhase(date: JulianDate): number {
	const year = date.year;
	const cycle = getLunarCycle(year);

	const march1 = julianDate(year, 3, 1);
	let diff = date.jdn - march1.jdn;
	if (diff < 0) {
		diff = date.jdn - julianDate(year - 1, 3, 1).jdn;
	}

	let remainder = mod(diff, LUNAR_MONTH);
	remainder += FOUNDATION[cycle - 1]!;
	while (remainder >= LUNAR_MONTH) remainder -= LUNAR_MONTH;

	return remainder / LUNAR_MONTH;
}

/** Bucket the fractional phase into one of the eight cardinal names, using
 *  a +/- half-lunar-day window around each cardinal point. */
export function getLunarPhaseName(date: JulianDate): LunarPhaseName {
	const raw = getLunarPhase(date);
	const r = LUNAR_HALF_DAY;
	if (raw < r || raw > 1 - r) return "new";
	if (raw < 0.25 - r) return "waxing-crescent";
	if (raw <= 0.25 + r) return "first-quarter";
	if (raw < 0.5 - r) return "waxing-gibbous";
	if (raw <= 0.5 + r) return "full";
	if (raw < 0.75 - r) return "waning-gibbous";
	if (raw <= 0.75 + r) return "last-quarter";
	return "waning-crescent";
}

/** Julian-calendar date of the next new moon on/after `date`, floor of the
 *  Metonic estimate (matches upstream rounding). */
export function getNextNewMoon(date: JulianDate): JulianDate {
	const age = getLunarPhase(date) * LUNAR_MONTH;
	const diff = Math.floor(LUNAR_MONTH - age);
	return shiftJdn(date, diff);
}

/** Julian-calendar date of the next full moon on/after `date`. */
export function getNextFullMoon(date: JulianDate): JulianDate {
	const age = getLunarPhase(date) * LUNAR_MONTH;
	let diff = Math.floor(LUNAR_MONTH / 2 - age);
	if (diff < 0) diff = Math.floor(LUNAR_MONTH / 2 - age + LUNAR_MONTH);
	return shiftJdn(date, diff);
}

function mod(a: number, m: number): number {
	return a - m * Math.floor(a / m);
}

function shiftJdn(date: JulianDate, days: number): JulianDate {
	return julianDateFromJdn(date.jdn + days);
}
