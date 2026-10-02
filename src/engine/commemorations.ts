// Multi-layer commemoration composer. Phase C1 ships the fixed-Julian layer
// (keyed by Julian MM-DD) plus synthesized season markers (Clean Monday,
// Sviatki, fast-period beginnings). Phase C2 adds the paschal/triodion
// movable layer. Phase C4 adds DOW-shift / DOW-nearest-Julian movables
// (Sunday/Saturday-anchored commemorations around a Julian landmark).
// Phase C5 adds per-year transfer rules for commemorations HTOC moves
// off their natural day under specific paschal conditions.

import type { Commemoration } from "../data/dayFacts.ts";
import { FIXED_COMMEMORATIONS_CYCLE, JULIAN_LEAP_TRANSFER_CYCLE } from "../data/fixedCommemorations.ts";
import { PASCHAL_MOVABLES_CYCLE } from "../data/paschalMovables.ts";
import { DOW_MOVABLES, type DowMovableRule } from "../data/dowMovables.ts";
import type { DayContext } from "./day.ts";
import { difference, julianDate } from "../core/calendar/jdate.ts";
import { getJulianPaschaRich } from "../paschalion.ts";
import { getLiturgicalSeason } from "./season.ts";

/**
 * Season-driven synthesized commemoration markers that HTOC prints at the
 * top of certain day pages (Clean Monday, Sviatki opening, fast-period
 * beginnings). Keyed off `DayContext` rather than any lookup table.
 */
export function getSeasonCommemorations(ctx: DayContext): readonly Commemoration[] {
	const out: Commemoration[] = [];
	const season = getLiturgicalSeason(ctx);

	// Clean Monday: first day of Great Lent (nday = -48 relative to Pascha).
	if (season === "great-lent" && ctx.nday === -48) {
		out.push({ rank: "0", text: "Clean Monday.", minor: false, lives: [] });
	}
	// Sviatki opening marker: HTOC prints it only on the Nativity itself
	// (Julian Dec 25), announcing the fast-free span through Jan 5.
	if (ctx.julian.month === 12 && ctx.julian.day === 25) {
		out.push({
			rank: "0",
			text: "From December 25 till January 5 is a Fast-free period (Sviatki).",
			minor: false,
			lives: [],
		});
	}
	// Apostles' (Peter & Paul) Fast: begins the Monday after All Saints
	// Sunday (All Saints is nday 56, so Monday is nday 57).
	if (ctx.nday === 57) {
		out.push({
			rank: "0",
			text: "Beginning of Apostles' (Peter & Paul) Fast",
			minor: false,
			lives: [],
		});
	}
	// Dormition Fast (Julian Aug 1). Note the single space before the period
	// — matches the vendored HTOC rendering exactly.
	if (ctx.julian.month === 8 && ctx.julian.day === 1) {
		out.push({
			rank: "0",
			text: "Beginning of the Dormition Fast .",
			minor: false,
			lives: [],
		});
	}
	// Nativity Fast (Julian Nov 15).
	if (ctx.julian.month === 11 && ctx.julian.day === 15) {
		out.push({
			rank: "0",
			text: "Beginning of Nativity Fast.",
			minor: false,
			lives: [],
		});
	}

	return out;
}

/**
 * Fixed-Julian commemoration lookup. Returns the HTOC commemoration entries
 * attached to this day's Julian month-day, independent of civil year.
 * Includes leap-gated entries for Julian Feb 28 ↔ Feb 29 transfer saints
 * (e.g. John Cassian the Roman — HTOC fires on Feb 29 in Julian leap years,
 * Feb 28 otherwise). Works for any year.
 */
export function getFixedCommemorations(ctx: DayContext): readonly Commemoration[] {
	const key = `${String(ctx.julian.month).padStart(2, "0")}-${String(ctx.julian.day).padStart(2, "0")}`;
	const always = FIXED_COMMEMORATIONS_CYCLE.get(key) ?? [];
	const leapGated = JULIAN_LEAP_TRANSFER_CYCLE.get(key);
	if (leapGated === undefined) return always;
	const isJulianLeap = ctx.julian.year % 4 === 0;
	const matched: Commemoration[] = [];
	for (const e of leapGated) {
		if (e.julianLeap === isJulianLeap) matched.push(e.commem);
	}
	if (matched.length === 0) return always;
	return [...always, ...matched];
}

/**
 * Paschal/triodion-cycle movable commemoration lookup. Returns entries
 * anchored to this day's `nday` (days from Pascha), works for any year.
 * Covers Pentecostarion Sundays, Bright Week weekdays, Ascension-anchored
 * feasts, Lenten Saturday/Sunday commemorations, Cheese-fare Week, etc.
 */
export function getPaschalMovables(ctx: DayContext): readonly Commemoration[] {
	return PASCHAL_MOVABLES_CYCLE.get(ctx.nday) ?? [];
}

// Non-leap-year Julian day-of-year ordinal. Dec 31 → 365. Julian year has
// no Feb 29 (leap handling adds at most one extra day, which cannot flip
// a ±7-day DOW window around any of our anchor dates), so the simple
// non-leap table is sufficient for the comparisons below.
const JULIAN_MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function julianOrdinal(month: number, day: number): number {
	let d = 0;
	for (let m = 0; m < month - 1; m++) d += JULIAN_MONTH_DAYS[m]!;
	return d + day;
}

/**
 * Signed day difference `current - anchor` across Julian year boundaries.
 * Wraps results into the range (-182, 182] so Dec-anchored rules match
 * correctly for January dates and vice versa.
 */
function julianOrdinalDiff(ctx: DayContext, julianMonth: number, julianDay: number): number {
	const current = julianOrdinal(ctx.julian.month, ctx.julian.day);
	const anchor = julianOrdinal(julianMonth, julianDay);
	let diff = current - anchor;
	if (diff > 182) diff -= 365;
	else if (diff < -182) diff += 365;
	return diff;
}

function matchesDowRule(ctx: DayContext, rule: DowMovableRule): boolean {
	if (rule.kind === "nday-set") return rule.ndays.includes(ctx.nday);
	if (ctx.dow !== rule.dow) return false;
	const diff = julianOrdinalDiff(ctx, rule.julianMonth, rule.julianDay);
	switch (rule.kind) {
		case "dow-after":        return diff >= 0 && diff <= 6;
		case "dow-after-strict": return diff >= 1 && diff <= 7;
		case "dow-before":       return diff <= 0 && diff >= -6;
		case "dow-before-strict":return diff <= -1 && diff >= -7;
		case "dow-nearest":      return diff >= -3 && diff <= 3;
		case "dow-window":       return diff >= rule.minDiff && diff <= rule.maxDiff;
	}
}

/**
 * DOW-shift / DOW-nearest-Julian movable commemoration lookup. Returns
 * entries anchored to a weekday relative to a Julian landmark date
 * (e.g. Sunday closest to Julian Jan 25, Saturday before Julian Oct 26,
 * 2nd/3rd/4th Lenten Parents' Saturdays). Works for any year.
 */
export function getDowMovables(ctx: DayContext): readonly Commemoration[] {
	const out: Commemoration[] = [];
	for (const m of DOW_MOVABLES) {
		if (matchesDowRule(ctx, m.rule)) out.push(m.commem);
	}
	return out;
}

// Nday of an arbitrary Julian month/day in a civil year. Used by Phase C5
// transfer rules whose trigger depends on where the natural Julian day
// lands relative to Pascha (which varies with the paschalion each year).
function ndayOfJulianMonthDay(year: number, month: number, day: number): number {
	return difference(julianDate(year, month, day), getJulianPaschaRich(year));
}

/**
 * Per-year transfer rules. For a small set of commemorations whose text
 * explicitly instructs a transfer under specific paschal conditions,
 * returns the entries HTOC emits on this day plus the exact texts of any
 * other-layer entries the composer should suppress to avoid double counting.
 */
export function getTransferOverlays(ctx: DayContext): {
	readonly emit: readonly Commemoration[];
	readonly suppressTexts: readonly string[];
} {
	const emit: Commemoration[] = [];
	const suppressTexts: string[] = [];

	// Rule 1: St. Dunchad / Hieromartyr Tikhon transfer composite.
	// When Annunciation (Julian Mar 25) falls on Holy Monday (nday=-13),
	// HTOC prints an extended Dunchad entry on Julian Mar 24 (nday=-14)
	// that absorbs Tikhon's repose commemoration transferred off Mar 25.
	// We suppress the plain fixed-Julian "St. Dunchad, abbot of Iona."
	// entry on that day to avoid duplication.
	if (ctx.julian.month === 3 && ctx.julian.day === 24 && ctx.nday === -14) {
		emit.push({
			rank: "o",
			text:
				"St. Dunchad, abbot of Iona. The Commemoration of the Repose of " +
				"Hieromartyr Tikhon, patriarch of Moscow and All Russia (1925) is " +
				"transferred from Monday, April 7/March 25 to this day.",
			minor: true,
			lives: [],
		});
		suppressTexts.push("St. Dunchad, abbot of Iona.");
	}

	// Rule 2: Meeting of the Mother of God and Saint Elizabeth.
	// Natural day is Julian Mar 30. When that day falls in the Lazarus-
	// Saturday-through-Pascha window (nday in [-8, 0]), HTOC transfers the
	// feast to Bright Friday (nday=5).
	const marchThirtyNday = ndayOfJulianMonthDay(ctx.julian.year, 3, 30);
	const elizabethTransfer = marchThirtyNday >= -8 && marchThirtyNday <= 0;
	const elizabethFires = elizabethTransfer
		? ctx.nday === 5
		: ctx.julian.month === 3 && ctx.julian.day === 30;
	if (elizabethFires) {
		emit.push({
			rank: "0",
			text:
				"The Meeting of the Mother of God and Saint Elizabeth " +
				"( movable Feast on March 30. If March 30 should fall between " +
				"Lazarus Saturday and Pascha, however, the Feast is transferred " +
				"to Bright Friday ).",
			minor: false,
			lives: [],
		});
	}

	return { emit, suppressTexts };
}

/**
 * Compose season markers + fixed-Julian + paschal-movable + DOW-shift
 * movable commemorations + per-year transfer overlays into a single list.
 * The transfer overlay runs last and can suppress exact-text matches from
 * the earlier layers (used for the Dunchad composite replacement).
 */
export function getCommemorationsForAnyYear(ctx: DayContext): readonly Commemoration[] {
	const base = [
		...getSeasonCommemorations(ctx),
		...getFixedCommemorations(ctx),
		...getPaschalMovables(ctx),
		...getDowMovables(ctx),
	];
	const overlay = getTransferOverlays(ctx);
	if (overlay.suppressTexts.length === 0 && overlay.emit.length === 0) {
		return base;
	}
	const suppress = new Set(overlay.suppressTexts);
	const filtered = suppress.size === 0 ? base : base.filter((c) => !suppress.has(c.text));
	return [...filtered, ...overlay.emit];
}
