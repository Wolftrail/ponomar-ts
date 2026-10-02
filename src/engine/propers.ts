// Given a Gregorian date, return the hymnographic propers (troparia and
// kontakia) for the day, sourced verbatim from HTOC. This is a thin
// filter over `LiturgicalDay.troparia` / `kontakia`, which in turn come
// from `dayFacts.ts`.
//
// HTOC is the single source of truth for user-facing propers in
// `ponomar-ts`. The upstream Ponomar `<TROPARION>` / `<KONTAKION>` XML
// is still vendored and still populates `Commemoration.hymns` in the
// data layer, but no public API surfaces it any more — doing so would
// produce two different English translations of the same hymn and
// drift against HTOC's authoritative wording.
//
// Dates outside the vendored HTOC coverage window (2025–2027) therefore
// return empty arrays. Composing a Pascha / Great Feast order of
// service is still possible via `composeService`, which emits opaque
// `create` directives that consumers fill from language packs.

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import type { DayContext } from "./day.ts";
import type { Hymn } from "./dayFacts.ts";
import { getLiturgicalDay } from "./index.ts";

export interface DailyPropers {
	readonly context: DayContext;
	readonly troparia: readonly Hymn[];
	readonly kontakia: readonly Hymn[];
}

export interface GetPropersOptions {
	/** Only include hymns of this kind. */
	readonly kind?: "troparion" | "kontakion";
}

export function getPropers(
	gregorian: CalendarDate,
	opts: GetPropersOptions = {},
): DailyPropers {
	const day = getLiturgicalDay(gregorian);
	return {
		context: day.context,
		troparia: opts.kind === "kontakion" ? [] : day.troparia,
		kontakia: opts.kind === "troparion" ? [] : day.kontakia,
	};
}
