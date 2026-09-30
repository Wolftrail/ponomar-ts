// The eleven resurrectional Matins Gospels ("Voskresnye Utrennie
// Evangeliya"). Read at Sunday Matins in a fixed 11-week cycle keyed off the
// week-count since last year's Pascha.
//
// The pericope table itself is universal in Byzantine practice but is *not*
// shipped in Ponomar's vendored XML: only 5 total `<SCRIPTURE Type="matins">`
// entries exist across all commemorations. The cycle formula, however, *is*
// spelled out — in `vendor/ponomar/Ponomar/languages/xml/Commemorations/T/35.xml`,
// whose Cmd guards read `((ndayP / 7 - 7) % 11 == N) && dRank != 6`. We
// mirror that formula here and hardcode the eleven pericopes.
//
// **Skip rules** (all short-circuit to `null`):
//   * `dow !== 0` — non-Sundays never carry a resurrectional matins gospel.
//   * `nday` in `[0, 55]` — Pascha through Pentecost inclusive; the
//     pentecostarion supplies its own matins gospels here.
//   * `dRank === 6` — Great Feast of the Theotokos on Sunday; the feast
//     entirely displaces the resurrection matins gospel. Matches the
//     upstream guard exactly (`dRank != 6`). Note: on Great Feasts of the
//     Lord (`dRank >= 7`) the resurrection matins gospel *is* still read
//     (per Fekula/Williams §1F3); displacement/ordering is handled downstream
//     by `getOrderedMatinsReadings`, not here.

import { parseBibleRef } from "../bible/parse.ts";
import type { BibleRef } from "../bible/types.ts";
import type { DayContext } from "./day.ts";

/** Raw Ponomar-style reading strings for the eleven resurrection matins
 *  gospels, in canonical order 1..11. Index `n - 1` corresponds to
 *  gospel number `n`. */
const READINGS: readonly string[] = [
	"Mt_28:16-20",
	"Mk_16:1-8",
	"Mk_16:9-20",
	"Lk_24:1-12",
	"Lk_24:12-35",
	"Lk_24:36-53",
	"Jn_20:1-10",
	"Jn_20:11-18",
	"Jn_20:19-31",
	"Jn_21:1-14",
	"Jn_21:15-25",
];

/** One entry in the resurrection matins gospel cycle. */
export interface ResurrectionMatinsGospel {
	/** Traditional cycle number, `1..11`. */
	readonly number: number;
	/** Raw Ponomar-style reading string (e.g. `"Mt_28:16-20"`). */
	readonly reading: string;
	/** Parsed reference. Well-formedness is guaranteed at module load. */
	readonly ref: BibleRef;
}

/** The eleven resurrection matins gospels, in canonical order. */
export const RESURRECTION_MATINS_GOSPELS: readonly ResurrectionMatinsGospel[] =
	READINGS.map((reading, i) => ({
		number: i + 1,
		reading,
		ref: parseBibleRef(reading),
	}));

/**
 * Compute the resurrectional Matins Gospel for `ctx`, or `null` when the
 * cycle is suppressed. See the module comment for the skip rules.
 *
 * @param ctx  Day context; supplies `dow`, `nday`, `ndayP`.
 * @param dRank Highest saint rank of the day. Defaults to `0`
 *   (`dslContext`'s initial value); pass `LiturgicalDay.dRank` when known.
 */
export function getResurrectionMatinsGospel(
	ctx: DayContext,
	dRank: number = 0,
): ResurrectionMatinsGospel | null {
	if (ctx.dow !== 0) return null;
	if (ctx.nday >= 0 && ctx.nday <= 55) return null;
	if (dRank === 6) return null;
	const raw = Math.trunc(ctx.ndayP / 7 - 7);
	const mod = ((raw % 11) + 11) % 11;
	const n = mod === 0 ? 11 : mod;
	return RESURRECTION_MATINS_GOSPELS[n - 1] ?? null;
}
