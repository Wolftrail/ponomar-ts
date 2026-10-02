// HTOC (Holy Trinity Orthodox Church, Jordanville / ROCOR) daily-lectionary
// override. Ponomar's vendored XML encodes the *Moscow Patriarchate*
// Slavonic recension of the Byzantine daily reading cycle; HTOC follows a
// different Lucan-Jump convention and picks different gospel pericopes on
// ~180 ordinary weekdays a year.
//
// This module reads the codegen'd `DAILY_LECTIONARY` table (keyed by
// `(ndayF, doy)`, empirically verified collision-free) and returns the
// HTOC-preferred no-note ("rjadovoje") Liturgy readings for the given day.
// See `scripts/codegen/daily-lectionary.ts` for how the table is
// derived from the fixture corpus.

import { DAILY_LECTIONARY } from "../data/dailyLectionary.ts";
import type { DailyLectionaryEntry } from "../data/dailyLectionary.ts";
import type { DayContext } from "./day.ts";

export type { DailyLectionaryEntry } from "../data/dailyLectionary.ts";
export { DAILY_LECTIONARY } from "../data/dailyLectionary.ts";

/** Return the HTOC daily-cycle Liturgy Apostol+Gospel picks for `ctx`, or
 *  `null` if `ctx` falls outside the vendored 2025–2030 coverage window
 *  (or on a slot HTOC didn't emit rjadovoje readings for). */
export function getDailyLectionary(
	ctx: DayContext,
): readonly DailyLectionaryEntry[] | null {
	const key = `${ctx.ndayF},${ctx.doy}`;
	return DAILY_LECTIONARY.get(key) ?? null;
}
