// Octoechos tone (1..8) for a given day, derived from Pascha.
//
// The 8-week tone cycle restarts the Monday after Thomas Sunday
// (= Pascha + 8 days, Pascha-relative index 8). From that Monday onward
// `tone = (floor((nday - 7) / 7) % 8) + 1`. For dates before this year's
// Pascha the same formula uses `ndayP` (days since the PRIOR year's Pascha).
//
// The underlying weekly tone is suppressed (returns `null`) during periods
// where HTOC does not print an Octoechos tone: Great Lent, Holy Week,
// Pascha + Bright Week, and every Sunday of the Pentecostarion through
// Pentecost itself. See `isToneSuppressed` for the exact ranges.

import type { DayContext } from "./day.ts";

/**
 * Octoechos tone for `ctx.gregorian`, or `null` when HTOC suppresses it
 * (Great Lent through Pentecost, and the handful of Great Feasts of the Lord
 * that displace the Resurrectional tone — see `isToneSuppressed`).
 */
export function getOctoechosTone(ctx: DayContext): number | null {
	if (isToneSuppressed(ctx)) return null;
	return rawOctoechosTone(ctx);
}

/**
 * Underlying weekly tone irrespective of suppression. Always 1..8.
 * Useful for diagnostics and for consumers that want to show "today's week
 * would be Tone X" on a null-tone day.
 */
export function rawOctoechosTone(ctx: DayContext): number {
	// Pre-Pascha dates: measure from LAST year's Pascha; post-Pascha: from
	// THIS year's. Both resolve to the same weekly cycle because the Octoechos
	// restarts at every Thomas Sunday.
	const base = ctx.nday >= 8 ? ctx.nday - 7 : ctx.ndayP - 7;
	const idx = Math.floor(base / 7);
	return ((((idx % 8) + 8) % 8) + 1);
}

/**
 * Days where HTOC prints no Resurrectional tone. Returns `true` for:
 *  - Palm Sunday (nday = -7)
 *  - Holy Week Mon–Sat (nday ∈ [-6, -1])
 *  - Pascha and Bright Week (nday ∈ [0, 6])
 *  - Thomas Sunday / Antipascha (nday = 7)
 *  - Pentecost (nday = 49)
 *
 * Note: Great Lent weekdays and Sundays, and the Pentecostarion Sundays
 * between Thomas and Pentecost (Myrrh-bearers, Paralytic, Samaritan,
 * Blind Man, Fathers of the First Council) all retain their underlying
 * Octoechos tone in HTOC's header, so they are NOT suppressed here.
 */
export function isToneSuppressed(ctx: DayContext): boolean {
	const n = ctx.nday;
	if (n >= -7 && n <= 7) return true;
	if (n === 49) return true;
	return false;
}
