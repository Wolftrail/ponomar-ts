// HTOC day-level facts, keyed by Gregorian date. Within the vendored 2025-2027
// corpus window `getDayFacts` returns the HTOC-published record verbatim
// (perfect fidelity). Outside the window it composes a best-effort record:
// `headerText`, `tone`, and `commemorations` come from the algorithmic layers
// (Phases A/B/C1-C5), while `fastText`, `troparia`, and `kontakia` are empty
// because they are HTOC publication content without an algorithmic analog.
//
// Phase D (plan: capstone). Previously this file only returned data within the
// vendored window and `null` elsewhere; now the engine answers for any year.

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { DAY_FACTS_BY_ISO } from "../data/dayFacts.ts";
import type { Commemoration, DayFacts, Hymn } from "../data/dayFacts.ts";
import { getCommemorationsForAnyYear } from "./commemorations.ts";
import { computeDayContext } from "./day.ts";
import { renderHeaderText } from "./headerText.ts";
import { getOctoechosTone } from "./tone.ts";

export type { Commemoration, DayFacts, Hymn } from "../data/dayFacts.ts";
export { DAY_FACTS_BY_ISO } from "../data/dayFacts.ts";

function toIso(d: CalendarDate): string {
	const mm = String(d.month).padStart(2, "0");
	const dd = String(d.day).padStart(2, "0");
	return `${d.year}-${mm}-${dd}`;
}

const EMPTY_HYMNS: readonly Hymn[] = [];

/** Return the HTOC-published day facts for `gregorian`. Within the vendored
 *  corpus window (2025-2027) this is the published record verbatim; outside
 *  the window it is an algorithmic best-effort with `headerText`, `tone`, and
 *  `commemorations` populated and `fastText`/`troparia`/`kontakia` empty. */
export function getDayFacts(gregorian: CalendarDate): DayFacts {
	const vendored = DAY_FACTS_BY_ISO.get(toIso(gregorian));
	if (vendored !== undefined) return vendored;
	const ctx = computeDayContext(gregorian);
	const headerText = renderHeaderText(ctx);
	const tone = getOctoechosTone(ctx);
	const commemorations: readonly Commemoration[] = getCommemorationsForAnyYear(ctx);
	return {
		headerText,
		tone,
		fastText: "",
		commemorations,
		troparia: EMPTY_HYMNS,
		kontakia: EMPTY_HYMNS,
	};
}

/** True when `gregorian` falls inside the vendored HTOC corpus window
 *  (2025-01-01 through 2027-12-31), so `getDayFacts` returns the
 *  HTOC-published record verbatim including `fastText`/`troparia`/`kontakia`. */
export function isVendoredDate(gregorian: CalendarDate): boolean {
	return DAY_FACTS_BY_ISO.has(toIso(gregorian));
}

