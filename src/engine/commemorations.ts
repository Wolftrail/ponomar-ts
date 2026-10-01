// Multi-layer commemoration composer. Phase C1 ships the fixed-Julian layer
// (keyed by Julian MM-DD) plus synthesized season markers (Clean Monday,
// Sviatki, fast-period beginnings). Phase C2 adds the paschal/triodion
// movable layer. Phase C4 adds DOW-shift / DOW-nearest-Julian movables
// (Sunday/Saturday-anchored commemorations around a Julian landmark).

import type { HtocCommemoration } from "../data/htocDayFacts.ts";
import { HTOC_FIXED_COMMEMORATIONS_CYCLE } from "../data/htocFixedCommemorations.ts";
import { HTOC_PASCHAL_MOVABLES_CYCLE } from "../data/htocPaschalMovables.ts";
import { HTOC_DOW_MOVABLES, type DowMovableRule } from "../data/htocDowMovables.ts";
import type { DayContext } from "./day.ts";
import { getLiturgicalSeason } from "./season.ts";

/**
 * Season-driven synthesized commemoration markers that HTOC prints at the
 * top of certain day pages (Clean Monday, Sviatki opening, fast-period
 * beginnings). Keyed off `DayContext` rather than any lookup table.
 */
export function getSeasonCommemorations(ctx: DayContext): readonly HtocCommemoration[] {
	const out: HtocCommemoration[] = [];
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
 * Works for any year.
 */
export function getFixedCommemorations(ctx: DayContext): readonly HtocCommemoration[] {
	const key = `${String(ctx.julian.month).padStart(2, "0")}-${String(ctx.julian.day).padStart(2, "0")}`;
	return HTOC_FIXED_COMMEMORATIONS_CYCLE.get(key) ?? [];
}

/**
 * Paschal/triodion-cycle movable commemoration lookup. Returns entries
 * anchored to this day's `nday` (days from Pascha), works for any year.
 * Covers Pentecostarion Sundays, Bright Week weekdays, Ascension-anchored
 * feasts, Lenten Saturday/Sunday commemorations, Cheese-fare Week, etc.
 */
export function getPaschalMovables(ctx: DayContext): readonly HtocCommemoration[] {
	return HTOC_PASCHAL_MOVABLES_CYCLE.get(ctx.nday) ?? [];
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
export function getDowMovables(ctx: DayContext): readonly HtocCommemoration[] {
	const out: HtocCommemoration[] = [];
	for (const m of HTOC_DOW_MOVABLES) {
		if (matchesDowRule(ctx, m.rule)) out.push(m.commem);
	}
	return out;
}

/**
 * Compose season markers + fixed-Julian + paschal-movable + DOW-shift
 * movable commemorations into a single list. Phase C4 handles everything
 * except per-year transferred composites (Phase C5).
 */
export function getCommemorationsForAnyYear(ctx: DayContext): readonly HtocCommemoration[] {
	return [
		...getSeasonCommemorations(ctx),
		...getFixedCommemorations(ctx),
		...getPaschalMovables(ctx),
		...getDowMovables(ctx),
	];
}
