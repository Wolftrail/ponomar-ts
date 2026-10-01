// Three-layer commemoration composer. Phase C1 ships the fixed-Julian layer
// (keyed by Julian MM-DD) plus synthesized season markers (Clean Monday,
// Sviatki, fast-period beginnings). Later sub-phases will add the paschal,
// triodion, and DOW-shift movable layers.

import type { HtocCommemoration } from "../data/htocDayFacts.ts";
import { HTOC_FIXED_COMMEMORATIONS_CYCLE } from "../data/htocFixedCommemorations.ts";
import { HTOC_PASCHAL_MOVABLES_CYCLE } from "../data/htocPaschalMovables.ts";
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

/**
 * Compose season markers + fixed-Julian + paschal-movable commemorations
 * into a single list. Phase C2 handles everything except DOW-nearest-Julian
 * movables (Phase C4) and per-year transferred composites (Phase C5).
 */
export function getCommemorationsForAnyYear(ctx: DayContext): readonly HtocCommemoration[] {
	return [
		...getSeasonCommemorations(ctx),
		...getFixedCommemorations(ctx),
		...getPaschalMovables(ctx),
	];
}
