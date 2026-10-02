// HTOC saint-scripture lookup. Mirror of `dailyLectionary.ts` but for
// *noted* HTOC scriptures — Matins Gospels, saint-specific Liturgy
// pericopes, Vespers Old-Testament readings, Six-Hour prophecies, and the
// other 200-plus categorised buckets in `SAINT_LECTIONARY`.
//
// Because saint feasts are date-anchored (not cycle-anchored), the table
// is keyed by ISO date rather than `(ndayF, doy)`. Coverage tracks the
// vendored corpus window; consult `SAINT_LECTIONARY_SIZE` for the
// exact date count.

import { SAINT_LECTIONARY } from "../data/saintLectionary.ts";
import type { SaintLectionaryEntry } from "../data/saintLectionary.ts";
import type { CalendarDate } from "../core/calendar/pcalendar.ts";

export type { SaintLectionaryEntry } from "../data/saintLectionary.ts";
export { SAINT_LECTIONARY } from "../data/saintLectionary.ts";

function pad2(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

/** Return the HTOC noted scriptures for `gregorian`, or `null` if the
 *  date falls outside the vendored corpus window or has no noted
 *  readings that day. */
export function getSaintLectionary(
	gregorian: CalendarDate,
): readonly SaintLectionaryEntry[] | null {
	const iso = `${gregorian.year}-${pad2(gregorian.month)}-${pad2(gregorian.day)}`;
	return SAINT_LECTIONARY.get(iso) ?? null;
}
