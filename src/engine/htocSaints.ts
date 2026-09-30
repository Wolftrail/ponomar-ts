// HTOC saint lookup — reads the codegen'd `HTOC_SAINTS_BY_ISO` table and
// returns HTOC-preferred saint commemorations for a Gregorian date.
//
// This is a data channel parallel to Ponomar's XML-driven paschal/menaion
// saints. HTOC ranks its saints on a different scale (see `HtocSaint.rank`
// glyph) — see `mapHtocRank()` for the mapping to Ponomar's numeric scale.

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { HTOC_SAINTS_BY_ISO } from "../data/htocSaints.ts";
import type { HtocSaint } from "../data/htocSaints.ts";

export type { HtocSaint } from "../data/htocSaints.ts";
export { HTOC_SAINTS_BY_ISO } from "../data/htocSaints.ts";

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
