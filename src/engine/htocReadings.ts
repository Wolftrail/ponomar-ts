// HTOC-only scripture lookup — the subset of `getDailyReadings` that
// restricts output to pericopes HTOC publishes in its day-page
// `scripture[]` block. Combines the (unnoted) daily lectionary and the
// (noted) saint lectionary into one list, with no Ponomar paschal /
// menaion structural extras.
//
// Use this when the app wants to render what HTOC's day page shows and
// nothing more. For the full liturgical reading surface — including
// Royal Hours OT prophecies, Great-Feast vespers prophecies, and
// polyeleos saint matins readings not surfaced on HTOC's daily feed —
// call `getDailyReadings` directly.
//
// Coverage tracks the vendored corpus window (2025–2027). Dates outside
// return `null`.

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { computeDayContext } from "./day.ts";
import { getHtocDailyLectionary } from "./dailyLectionary.ts";
import type { ReadingRef } from "./readings.ts";
import { getHtocSaintLectionary } from "./saintLectionary.ts";

/** Return every scripture HTOC publishes for `gregorian`, union of the
 *  rjadovoje daily cycle and the noted saint lectionary. `null` if the
 *  date is outside the vendored corpus window (2025–2027) and HTOC has
 *  no data to return. */
export function getHtocReadings(gregorian: CalendarDate): readonly ReadingRef[] | null {
	const ctx = computeDayContext(gregorian);
	const daily = getHtocDailyLectionary(ctx);
	const saint = getHtocSaintLectionary(gregorian);
	if (daily === null && saint === null) return null;

	const refs: ReadingRef[] = [];
	const seen = new Set<string>();

	if (saint !== null) {
		for (const e of saint) {
			const key = `${e.service}/${e.reading}`;
			if (seen.has(key)) continue;
			seen.add(key);
			refs.push({
				cId: "htoc:saint-lectionary",
				source: "htoc",
				service: e.service as ReadingRef["service"],
				type: e.type,
				reading: e.reading,
				...(e.note !== "" ? { note: e.note } : {}),
				...(e.hour !== undefined ? { hour: e.hour } : {}),
			});
		}
	}
	if (daily !== null) {
		for (const e of daily) {
			const key = `liturgy/${e.reading}`;
			if (seen.has(key)) continue;
			seen.add(key);
			refs.push({
				cId: "htoc:daily-lectionary",
				source: "htoc",
				service: "liturgy",
				type: e.type,
				reading: e.reading,
			});
		}
	}
	return refs;
}
