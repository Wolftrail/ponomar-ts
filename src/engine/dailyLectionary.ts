// HTOC (Holy Trinity Orthodox Church, Jordanville / ROCOR) daily-lectionary
// override. Ponomar's vendored XML encodes the *Moscow Patriarchate*
// Slavonic recension of the Byzantine daily reading cycle; HTOC follows a
// different Lucan-Jump convention and picks different gospel pericopes on
// ~180 ordinary weekdays a year.
//
// This module reads the codegen'd `HTOC_DAILY_LECTIONARY` table (keyed by
// `(ndayF, doy)`, empirically verified collision-free) and returns the
// HTOC-preferred no-note ("rjadovoje") Liturgy readings for the given day.
// See `scripts/codegen/htoc-daily-lectionary.ts` for how the table is
// derived from the fixture corpus.

import { HTOC_DAILY_LECTIONARY } from "../data/htocDailyLectionary.ts";
import type { HtocDailyLectionaryEntry } from "../data/htocDailyLectionary.ts";
import type { DayContext } from "./day.ts";

export type { HtocDailyLectionaryEntry } from "../data/htocDailyLectionary.ts";
export { HTOC_DAILY_LECTIONARY } from "../data/htocDailyLectionary.ts";

/** Return the HTOC daily-cycle Liturgy Apostol+Gospel picks for `ctx`, or
 *  `null` if `ctx` falls outside the vendored 2025–2027 coverage window
 *  (or on a slot HTOC didn't emit rjadovoje readings for). */
export function getHtocDailyLectionary(
	ctx: DayContext,
): readonly HtocDailyLectionaryEntry[] | null {
	const key = `${ctx.ndayF},${ctx.doy}`;
	return HTOC_DAILY_LECTIONARY.get(key) ?? null;
}
