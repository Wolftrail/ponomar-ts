// HTOC saint-scripture lookup. Mirror of `dailyLectionary.ts` but for
// *noted* HTOC scriptures — Matins Gospels, saint-specific Liturgy
// pericopes, Vespers Old-Testament readings, Six-Hour prophecies, and the
// other 200-plus categorised buckets in `HTOC_SAINT_LECTIONARY`.
//
// Because saint feasts are date-anchored (not cycle-anchored), the table
// is keyed by ISO date rather than `(ndayF, doy)`. Coverage tracks the
// vendored corpus window; consult `HTOC_SAINT_LECTIONARY_SIZE` for the
// exact date count.

import { HTOC_SAINT_LECTIONARY } from "../data/htocSaintLectionary.ts";
import type { HtocSaintLectionaryEntry } from "../data/htocSaintLectionary.ts";
import type { CalendarDate } from "../core/calendar/pcalendar.ts";

export type { HtocSaintLectionaryEntry } from "../data/htocSaintLectionary.ts";
export { HTOC_SAINT_LECTIONARY } from "../data/htocSaintLectionary.ts";

function pad2(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

/** Return the HTOC noted scriptures for `gregorian`, or `null` if the
 *  date falls outside the vendored corpus window or has no noted
 *  readings that day. */
export function getHtocSaintLectionary(
	gregorian: CalendarDate,
): readonly HtocSaintLectionaryEntry[] | null {
	const iso = `${gregorian.year}-${pad2(gregorian.month)}-${pad2(gregorian.day)}`;
	return HTOC_SAINT_LECTIONARY.get(iso) ?? null;
}
