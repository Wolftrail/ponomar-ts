// Compose HTOC troparia and kontakia for any civil year by consulting the
// three position-stable cycle maps emitted by
// `scripts/codegen/htoc-hymns-cycle.ts`. Covers ~93 % of occurrences
// observed in the vendored 2025-2027 window; year-unstable propers
// (DOW-shift / per-year transfers) have no algorithmic analog and are
// omitted.

import type { HtocHymn } from "../data/htocDayFacts.ts";
import {
	HTOC_FIXED_HYMNS_CYCLE,
	HTOC_PASCHAL_HYMNS_CYCLE,
	HTOC_SUNDAY_TONE_HYMNS_CYCLE,
} from "../data/htocHymnsCycle.ts";
import type { DayContext } from "./day.ts";

export interface HtocHymnsForDay {
	readonly troparia: readonly HtocHymn[];
	readonly kontakia: readonly HtocHymn[];
}

const EMPTY: HtocHymnsForDay = { troparia: [], kontakia: [] };

/** Compose the day's HTOC propers for any year by composing the three
 *  cycle maps. Order mirrors HTOC's publication convention: Sunday
 *  resurrectional first (if the day is a tone-published Sunday), then
 *  paschal-cycle entries, then fixed-Julian saint entries. */
export function getHtocHymnsForAnyYear(
	ctx: DayContext,
	tone: number | null,
): HtocHymnsForDay {
	const julianKey = `${String(ctx.julian.month).padStart(2, "0")}-${String(ctx.julian.day).padStart(2, "0")}`;
	const fixed = HTOC_FIXED_HYMNS_CYCLE.get(julianKey);
	const paschal = HTOC_PASCHAL_HYMNS_CYCLE.get(ctx.nday);
	const sunday =
		ctx.dow === 0 && tone !== null
			? HTOC_SUNDAY_TONE_HYMNS_CYCLE.get(tone)
			: undefined;
	if (fixed === undefined && paschal === undefined && sunday === undefined) {
		return EMPTY;
	}
	return {
		troparia: [
			...(sunday?.troparia ?? []),
			...(paschal?.troparia ?? []),
			...(fixed?.troparia ?? []),
		],
		kontakia: [
			...(sunday?.kontakia ?? []),
			...(paschal?.kontakia ?? []),
			...(fixed?.kontakia ?? []),
		],
	};
}
