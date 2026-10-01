// HTOC saint lookup — reads the codegen'd `HTOC_SAINTS_BY_ISO` table and
// returns HTOC-preferred saint commemorations for a Gregorian date.
//
// This is a data channel parallel to Ponomar's XML-driven paschal/menaion
// saints. HTOC ranks its saints on a different scale (see `HtocSaint.rank`
// glyph) — see `mapHtocRank()` for the mapping to Ponomar's numeric scale.

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { difference as diffG } from "../core/calendar/pcalendar.ts";
import { fromGregorian } from "../core/calendar/jdate.ts";
import { getOrthodoxPascha } from "../paschalion.ts";
import {
	HTOC_SAINTS_BY_ISO,
	HTOC_SAINT_EXCEPTIONS,
	HTOC_SAINT_FIXED_CYCLE,
	HTOC_SAINT_MOVABLE_CYCLE,
} from "../data/htocSaints.ts";
import type { HtocSaint } from "../data/htocSaints.ts";

export type { HtocSaint } from "../data/htocSaints.ts";
export {
	HTOC_SAINTS_BY_ISO,
	HTOC_SAINT_EXCEPTIONS,
	HTOC_SAINT_FIXED_CYCLE,
	HTOC_SAINT_MOVABLE_CYCLE,
} from "../data/htocSaints.ts";

/** Format a `CalendarDate` as `YYYY-MM-DD`. */
function toIso(d: CalendarDate): string {
	const mm = String(d.month).padStart(2, "0");
	const dd = String(d.day).padStart(2, "0");
	return `${d.year}-${mm}-${dd}`;
}

/** Return the HTOC saints commemorated on `gregorian`, or `null` outside
 *  the vendored coverage window (2025–2027). */
export function getHtocSaintsFor(
	gregorian: CalendarDate,
): readonly HtocSaint[] | null {
	return HTOC_SAINTS_BY_ISO.get(toIso(gregorian)) ?? null;
}

/** Return the HTOC saints commemorated on `gregorian` for any Gregorian
 *  year (not limited to the 2025–2027 vendored window).
 *
 *  Resolution strategy:
 *   1. If the date lies in the vendored window, return the historical
 *      scraped list verbatim (identical to {@link getHtocSaintsFor}),
 *      preserving HTOC's display order.
 *   2. Otherwise, union the fixed-cycle (Julian MM-DD), movable-cycle
 *      (Pascha offset in days), and ISO exception layers from the cycle
 *      tables. Entries are slug-sorted within each cycle; the layers are
 *      concatenated fixed → movable → exceptions.
 *
 *  Unlike {@link getHtocSaintsFor} this function never returns `null`;
 *  dates with no commemorations return an empty array (rare in practice —
 *  every Julian day in the menaion carries at least one saint). */
export function getHtocSaintsForAnyYear(
	gregorian: CalendarDate,
): readonly HtocSaint[] {
	const iso = toIso(gregorian);
	const windowHit = HTOC_SAINTS_BY_ISO.get(iso);
	if (windowHit !== undefined) return windowHit;

	// Fixed cycle: look up by Julian month-day.
	const j = fromGregorian(gregorian);
	const fixedKey = `${String(j.month).padStart(2, "0")}-${String(j.day).padStart(2, "0")}`;
	const fixedHits = HTOC_SAINT_FIXED_CYCLE.get(fixedKey) ?? [];

	// Movable cycle: look up by Pascha offset for this civil year.
	const pascha = getOrthodoxPascha(gregorian.year);
	const offset = diffG(gregorian, pascha);
	const movableHits = HTOC_SAINT_MOVABLE_CYCLE.get(offset) ?? [];

	// ISO exceptions apply only within the vendored window (by definition
	// of their keying) so this returns empty outside it, which is correct:
	// cycle-unstable saints only have observations inside the window.
	const exceptionHits = HTOC_SAINT_EXCEPTIONS.get(iso) ?? [];

	if (fixedHits.length === 0 && movableHits.length === 0 && exceptionHits.length === 0) {
		return [];
	}
	return [...fixedHits, ...movableHits, ...exceptionHits];
}

/**
 * Map HTOC rank glyph to Ponomar's numeric rank scale.
 *
 * HTOC glyphs are `"0"` (no service), `"1"` (six-stich / minor vigil),
 * `"2"`/`"3"` (polyeleos variants), `"4"` (polyeleos), `"6"` (Great Feast),
 * `"o"` (Old-Rite / OCA-style unranked). Ponomar uses 0..8 where 6 = Great
 * Feast of the Theotokos, 7 = Great Feast of the Lord, 8 = Pascha.
 *
 * The returned value tracks upstream `<CHURCH Rank>` semantics closely
 * enough for `dRank`-gated code paths (matins-gospel eligibility, fasting
 * exemptions, service-template selection) to behave correctly.
 */
export function mapHtocRank(glyph: string): number {
	switch (glyph) {
		case "6":
			return 7; // Great Feast of the Lord (HTOC tops out at 6)
		case "4":
			return 5; // Polyeleos → Ponomar vigil-rank
		case "3":
			return 4;
		case "2":
			return 3;
		case "1":
			return 2; // Six-stichera / minor vigil
		case "o":
			return 1; // Un-ranked; treat as simple daily
		case "0":
		default:
			return 0;
	}
}

/** Inverse of {@link mapHtocRank}: Ponomar's 0..8 scale → HTOC glyph. Used
 *  when projecting Ponomar `ResolvedSaint`s into `HtocSaint` shape for
 *  dates outside the vendored HTOC coverage window. Pascha (8) and the
 *  Great Feasts of the Lord (7) both collapse onto HTOC's top glyph "6"
 *  since HTOC does not distinguish them in its ranking. */
export function unmapHtocRank(rank: number): string {
	if (rank >= 6) return "6";
	if (rank === 5) return "4";
	if (rank === 4) return "3";
	if (rank === 3) return "2";
	if (rank === 2) return "1";
	if (rank === 1) return "o";
	return "0";
}

/** Max HTOC-derived rank across all saints on `gregorian` (0 if none). */
export function getHtocDayRank(gregorian: CalendarDate): number {
	const saints = getHtocSaintsFor(gregorian);
	if (saints === null) return 0;
	let max = 0;
	for (const s of saints) {
		const r = mapHtocRank(s.rank);
		if (r > max) max = r;
	}
	return max;
}
