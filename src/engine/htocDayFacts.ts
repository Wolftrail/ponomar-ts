// HTOC day-level fact lookup — propers (troparia / kontakia), tone,
// fast rule, and the header line, keyed by ISO date. Parallel to
// `htocSaints.ts` and `dailyLectionary.ts`, which cover the saint
// commemoration list and the daily lectionary from the same corpus.

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { HTOC_DAY_FACTS_BY_ISO } from "../data/htocDayFacts.ts";
import type { HtocCommemoration, HtocDayFacts, HtocHymn } from "../data/htocDayFacts.ts";

export type { HtocCommemoration, HtocDayFacts, HtocHymn } from "../data/htocDayFacts.ts";
export { HTOC_DAY_FACTS_BY_ISO } from "../data/htocDayFacts.ts";

function toIso(d: CalendarDate): string {
	const mm = String(d.month).padStart(2, "0");
	const dd = String(d.day).padStart(2, "0");
	return `${d.year}-${mm}-${dd}`;
}

/** Return the HTOC-published day facts for `gregorian`, or `null` outside
 *  the vendored coverage window (2025–2027). */
export function getHtocDayFacts(gregorian: CalendarDate): HtocDayFacts | null {
	return HTOC_DAY_FACTS_BY_ISO.get(toIso(gregorian)) ?? null;
}
