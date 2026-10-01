// HTOC-only scripture view — filters `getDailyReadings` down to the
// pericopes HTOC's day page publishes (daily rjadovoje liturgy pair +
// matins gospel + any noted saint-lectionary / Royal Hours entries).
// Pure derivation on top of the main engine; no fixture-window gate.
// Inside the vendored 2025–2027 corpus, HTOC-tagged refs provide
// ground-truth output; outside that window the Ponomar algorithm fills
// in from menaion/triodion/pentecostarion/paschalion data.

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import type { ReadingRef } from "./readings.ts";
import { getDailyReadings } from "./readings.ts";

/** Matins gospel slot — HTOC uses `"gospel"`, Ponomar menaion uses
 *  numeric types (`"1"` for the single festal gospel; `"1".."12"` for
 *  Great Friday's twelve Passion Gospels). */
function isMatinsGospelType(type: string): boolean {
	return type === "gospel" || /^\d+$/.test(type);
}

/** Return every scripture HTOC's day page would publish for `gregorian`:
 *  liturgy apostol+gospel, matins gospel, and any noted entry (Royal
 *  Hours, saint's apostol/gospel, Vespers OT prophecy). For in-window
 *  dates (2025–2027) the result matches HTOC's published feed verbatim;
 *  for out-of-window dates it is the Ponomar algorithm's best
 *  approximation using the same underlying menaion data. */
export function getHtocReadings(gregorian: CalendarDate): readonly ReadingRef[] {
	const refs = getDailyReadings(gregorian).refs;
	return refs.filter(
		(r) =>
			r.source === "htoc" ||
			r.service === "liturgy" ||
			(r.service === "matins" && isMatinsGospelType(r.type)) ||
			r.hour !== undefined,
	);
}

