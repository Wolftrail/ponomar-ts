// Compose HTOC troparia and kontakia for any civil year by consulting the
// four position-stable cycle maps emitted by
// `scripts/codegen/hymns-cycle.ts`. Covers ~99 % of occurrences
// observed in the vendored 2025-2027 window; the small residue is
// out-of-observed-window moveable Sundays whose Julian date falls
// outside the window the vendored data spans.

import type { Hymn } from "../data/dayFacts.ts";
import {
	DOW_JULIAN_WINDOW_HYMNS_CYCLE,
	FIXED_HYMNS_CYCLE,
	PASCHAL_HYMNS_CYCLE,
	SUNDAY_TONE_HYMNS_CYCLE,
} from "../data/hymnsCycle.ts";
import type { DayContext } from "./day.ts";

export interface HymnsForDay {
	readonly troparia: readonly Hymn[];
	readonly kontakia: readonly Hymn[];
}

const EMPTY: HymnsForDay = { troparia: [], kontakia: [] };

/** Compose the day's HTOC propers for any year by composing the four
 *  cycle maps. Order mirrors HTOC's publication convention: Sunday
 *  resurrectional first (if the day is a tone-published Sunday), then
 *  paschal-cycle entries, then moveable-Sunday feast propers, then
 *  fixed-Julian saint entries. */
export function getHymnsForAnyYear(
	ctx: DayContext,
	tone: number | null,
): HymnsForDay {
	const julianKey = `${String(ctx.julian.month).padStart(2, "0")}-${String(ctx.julian.day).padStart(2, "0")}`;
	const fixed = FIXED_HYMNS_CYCLE.get(julianKey);
	const paschal = PASCHAL_HYMNS_CYCLE.get(ctx.nday);
	const sunday =
		ctx.dow === 0 && tone !== null
			? SUNDAY_TONE_HYMNS_CYCLE.get(tone)
			: undefined;
	const dowJulian = DOW_JULIAN_WINDOW_HYMNS_CYCLE.get(`${ctx.dow}-${julianKey}`);
	if (fixed === undefined && paschal === undefined && sunday === undefined && dowJulian === undefined) {
		return EMPTY;
	}
	return {
		troparia: [
			...(sunday?.troparia ?? []),
			...(paschal?.troparia ?? []),
			...(dowJulian?.troparia ?? []),
			...(fixed?.troparia ?? []),
		],
		kontakia: [
			...(sunday?.kontakia ?? []),
			...(paschal?.kontakia ?? []),
			...(dowJulian?.kontakia ?? []),
			...(fixed?.kontakia ?? []),
		],
	};
}
