// Ported from Ponomar/Main.java write() (typiconman/ponomar): the variables the expression language sees for a day.

import { dayOfWeek, dayOfYear, difference, julianDate } from "../core/calendar/jdate.ts";
import type { DslContext } from "../core/dsl/index.ts";
import { getPascha } from "../paschalion.ts";

/** A date on the Julian calendar. */
export interface JulianDay {
	readonly year: number;
	readonly month: number;
	readonly day: number;
}

/** 0 follows the Jordanville lectionary, 1 the Lucan Jump (upstream `GS`). */
export type GospelScheme = 0 | 1;

/**
 * The variables of the expression language for a Julian date. `dRank` starts at 0 as in upstream and is
 * raised by day resolution once the day's commemorations are known.
 */
export function dayVariables(date: JulianDay, gospelScheme: GospelScheme): DslContext {
	const today = julianDate(date.year, date.month, date.day);
	return {
		dow: dayOfWeek(today),
		doy: dayOfYear(today),
		nday: difference(today, getPascha(today.year)),
		ndayP: difference(today, getPascha(today.year - 1)),
		ndayF: difference(today, getPascha(today.year + 1)),
		GS: gospelScheme,
		Year: today.year,
		dRank: 0,
	};
}
