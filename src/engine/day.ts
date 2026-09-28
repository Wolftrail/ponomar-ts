// The day-context calculator: given a Gregorian date, produce the numeric
// variables that the upstream StringOp DSL expects (`doy`, `dow`, `nday`,
// `ndayP`, `ndayF`). Follows upstream conventions: all values derive from
// the *Julian* civil-date equivalent (that is what the Ponomar engine and
// its rule XML use).

import type { JulianDate } from "../core/calendar/jdate.ts";
import {
	dayOfWeek,
	dayOfYear,
	difference,
	fromGregorian,
} from "../core/calendar/jdate.ts";
import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { getJulianPaschaRich } from "../paschalion.ts";

/**
 * Numeric context variables for a single day, in the shape the StringOp DSL
 * expects. Sunday is `dow === 0`; `doy` is 0-indexed to match upstream.
 */
export interface DayContext {
	readonly gregorian: CalendarDate;
	readonly julian: JulianDate;
	readonly doy: number;
	readonly dow: number;
	readonly nday: number;
	readonly ndayP: number;
	readonly ndayF: number;
}

export function computeDayContext(gregorian: CalendarDate): DayContext {
	const julian = fromGregorian(gregorian);
	const year = julian.year;
	const paschaThis = getJulianPaschaRich(year);
	const paschaPrev = getJulianPaschaRich(year - 1);
	const paschaNext = getJulianPaschaRich(year + 1);
	return {
		gregorian,
		julian,
		doy: dayOfYear(julian),
		dow: dayOfWeek(julian),
		nday: difference(julian, paschaThis),
		ndayP: difference(julian, paschaPrev),
		ndayF: difference(julian, paschaNext),
	};
}

/**
 * Format a `DayContext` as a plain lookup table for the DSL evaluator.
 * `dRank` defaults to 0 (upstream Main.java's initial state before any
 * commemorations have been read); pass a computed rank via `extra` once
 * you know it (see `getLiturgicalDay` for the max-over-saints logic).
 */
export function dslContext(
	ctx: DayContext,
	extra?: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
	return {
		doy: ctx.doy,
		dow: ctx.dow,
		nday: ctx.nday,
		ndayP: ctx.ndayP,
		ndayF: ctx.ndayF,
		dRank: 0,
		GS: 1,
		...extra,
	};
}
