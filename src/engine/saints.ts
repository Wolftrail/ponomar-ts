// Saint-centric API — translates between HTOC slugs and Ponomar cIds,
// and gathers everything the UI needs for a /saints/<id> route into one
// shape. HTOC is the public identity (slug); Ponomar's cId stays as an
// internal implementation detail used to join to the lives corpus.

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import type { Saint } from "../data/saints.ts";
import { MENAION } from "../data/menaion.ts";
import { LIVES } from "../data/lives.ts";
import type { Life } from "../data/types.ts";

const MONTH_NAME_TO_NUM: Readonly<Record<string, string>> = {
	January: "01", February: "02", March: "03", April: "04", May: "05", June: "06",
	July: "07", August: "08", September: "09", October: "10", November: "11", December: "12",
};

const FIXED_SLUG_RE = /^([A-Z][a-z]+)\/(\d{2})-(\d{2})$/;

/** Resolve an HTOC slug to the Ponomar `cId` for the same saint. Supports
 *  only fixed-cycle slugs of the form `Month/DD-NN` (menaion). Movable
 *  slugs (`Epiphany/p±N`, etc.) and HTOC-only entries (icons without a
 *  Ponomar counterpart) return `null`. */
export function slugToCId(slug: string): string | null {
	const m = FIXED_SLUG_RE.exec(slug);
	if (m === null) return null;
	const mm = MONTH_NAME_TO_NUM[m[1]!];
	if (mm === undefined) return null;
	const key = `${mm}-${m[2]}`;
	const idx = parseInt(m[3]!, 10) - 1;
	return MENAION[key]?.saints[idx]?.cId ?? null;
}

const CID_TO_SLUG = ((): ReadonlyMap<string, string> => {
	const out = new Map<string, string>();
	const NUM_TO_MONTH = Object.entries(MONTH_NAME_TO_NUM).reduce<Record<string, string>>((a, [n, m]) => { a[m] = n; return a; }, {});
	for (const [key, day] of Object.entries(MENAION)) {
		const [mm, dd] = key.split("-") as [string, string];
		const monthName = NUM_TO_MONTH[mm];
		if (monthName === undefined) continue;
		for (let i = 0; i < day.saints.length; i++) {
			const cId = day.saints[i]!.cId;
			if (out.has(cId)) continue;
			out.set(cId, `${monthName}/${dd}-${String(i + 1).padStart(2, "0")}`);
		}
	}
	return out;
})();

/** Reverse of `slugToCId`: produce the canonical HTOC slug for a Ponomar
 *  `cId` by scanning the menaion. Returns `null` for cIds that have no
 *  fixed-menaion placement (movable-cycle saints, synthetic placeholders). */
export function cIdToSlug(cId: string): string | null {
	return CID_TO_SLUG.get(cId) ?? null;
}

/** Life text for a saint identified by HTOC slug. Thin wrapper over
 *  `getLife(cId)` + the slug bridge. */
export function getLifeBySlug(slug: string): Life | null {
	const cId = slugToCId(slug);
	if (cId === null) return null;
	return LIVES[cId] ?? null;
}

export interface SaintCommemoration {
	readonly iso: string;
	readonly gregorian: CalendarDate;
	readonly rank: string;
	readonly text: string;
	readonly cycle: "fixed" | "movable";
}

/** Everything needed to render a /saints/<slug> route in one shape. */
export interface SaintProfile {
	readonly slug: string;
	/** Ponomar lives-corpus identifier when a positional menaion match exists. */
	readonly cId: string | null;
	readonly names: readonly string[];
	/** Every Gregorian date in the vendored HTOC window (2025–2030) where
	 *  this saint is commemorated, in chronological order. */
	readonly commemorations: readonly SaintCommemoration[];
	readonly life: Life | null;
}

function parseIso(iso: string): CalendarDate {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	return { year: y, month: m, day: d };
}

/** Saint-centric lookup. Returns `null` only when the slug never appears
 *  in the vendored HTOC corpus. */
export function getSaint(slug: string): SaintProfile | null {
	const commemorations: SaintCommemoration[] = [];
	let names: readonly string[] = [];
	for (const [iso, saints] of SAINTS_BY_ISO) {
		const entry = saints.find((s: Saint) => s.slug === slug);
		if (entry === undefined) continue;
		if (names.length === 0) names = entry.names;
		commemorations.push({
			iso,
			gregorian: parseIso(iso),
			rank: entry.rank,
			text: entry.text,
			cycle: entry.cycle,
		});
	}
	if (commemorations.length === 0) return null;
	commemorations.sort((a, b) => a.iso.localeCompare(b.iso));
	const cId = slugToCId(slug);
	return {
		slug,
		cId,
		names,
		commemorations,
		life: cId !== null ? (LIVES[cId] ?? null) : null,
	};
}

/** `getSaint` indirection for callers who hold a Ponomar `cId` (e.g.
 *  legacy `/saints/437` routes). Resolves `cId` → slug first, then
 *  delegates. */
export function getSaintByCId(cId: string): SaintProfile | null {
	const slug = cIdToSlug(cId);
	if (slug === null) {
		// cId has no menaion placement — synthesize a profile from LIVES alone.
		const life = LIVES[cId];
		if (life === undefined) return null;
		return { slug: `ponomar/${cId}`, cId, names: [], commemorations: [], life };
	}
	return getSaint(slug);
}

// --- HTOC saint lookup / cycle resolution ---------------------------
// (Formerly src/engine/htocSaints.ts; merged on prefix removal.)
// HTOC saint lookup — reads the codegen'd `SAINTS_BY_ISO` table and
// returns HTOC-preferred saint commemorations for a Gregorian date.
//
// This is a data channel parallel to Ponomar's XML-driven paschal/menaion
// saints. HTOC ranks its saints on a different scale (see `Saint.rank`
// glyph) — see `mapRank()` for the mapping to Ponomar's numeric scale.

import { difference as diffG } from "../core/calendar/pcalendar.ts";
import { fromGregorian } from "../core/calendar/jdate.ts";
import { getOrthodoxPascha } from "../paschalion.ts";
import {
	SAINT_EXCEPTIONS,
	SAINT_FIXED_CYCLE,
	SAINT_MOVABLE_CYCLE,
} from "../data/saints.ts";

export type { Saint } from "../data/saints.ts";
export {
	SAINT_EXCEPTIONS,
	SAINT_FIXED_CYCLE,
	SAINT_MOVABLE_CYCLE,
} from "../data/saints.ts";

/** Format a `CalendarDate` as `YYYY-MM-DD`. */
function toIso(d: CalendarDate): string {
	const mm = String(d.month).padStart(2, "0");
	const dd = String(d.day).padStart(2, "0");
	return `${d.year}-${mm}-${dd}`;
}

/** Build the per-ISO saint map for the 2025–2030 vendored window by
 *  unioning the three cycle layers for each day in the window. Order
 *  within each day is slug-ascending (concatenated fixed → movable →
 *  exceptions) rather than HTOC's as-scraped order; the round-trip is
 *  set-equal across every vendored day. */
function buildSaintsByIso(): ReadonlyMap<string, readonly Saint[]> {
	const out = new Map<string, readonly Saint[]>();
	for (let year = 2025; year <= 2030; year++) {
		const pascha = getOrthodoxPascha(year);
		for (let month = 1; month <= 12; month++) {
			const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
			for (let day = 1; day <= daysInMonth; day++) {
				const greg: CalendarDate = { year, month, day };
				const j = fromGregorian(greg);
				const fixedKey = `${String(j.month).padStart(2, "0")}-${String(j.day).padStart(2, "0")}`;
				const fixed = SAINT_FIXED_CYCLE.get(fixedKey) ?? [];
				const movable = SAINT_MOVABLE_CYCLE.get(diffG(greg, pascha)) ?? [];
				const iso = toIso(greg);
				const exceptions = SAINT_EXCEPTIONS.get(iso) ?? [];
				if (fixed.length === 0 && movable.length === 0 && exceptions.length === 0) continue;
				out.set(iso, [...fixed, ...movable, ...exceptions]);
			}
		}
	}
	return out;
}

/** ISO-date → HTOC saint commemorations for that day. Built from the
 *  cycle tables at module load (see `buildSaintsByIso`); set-equal to
 *  HTOC's as-scraped per-day list across the vendored window.
 *  Coverage: 2025-01-01 through 2030-12-31 (vendored corpus window). */
export const SAINTS_BY_ISO: ReadonlyMap<string, readonly Saint[]> = buildSaintsByIso();

/** Return the HTOC saints commemorated on `gregorian`, or `null` outside
 *  the vendored coverage window (2025–2030). */
export function getSaintsFor(
	gregorian: CalendarDate,
): readonly Saint[] | null {
	return SAINTS_BY_ISO.get(toIso(gregorian)) ?? null;
}

/** Return the HTOC saints commemorated on `gregorian` for any Gregorian
 *  year (not limited to the 2025–2030 vendored window).
 *
 *  Resolution strategy:
 *   1. If the date lies in the vendored window, return the historical
 *      scraped list verbatim (identical to {@link getSaintsFor}),
 *      preserving HTOC's display order.
 *   2. Otherwise, union the fixed-cycle (Julian MM-DD), movable-cycle
 *      (Pascha offset in days), and ISO exception layers from the cycle
 *      tables. Entries are slug-sorted within each cycle; the layers are
 *      concatenated fixed → movable → exceptions.
 *
 *  Unlike {@link getSaintsFor} this function never returns `null`;
 *  dates with no commemorations return an empty array (rare in practice —
 *  every Julian day in the menaion carries at least one saint). */
export function getSaintsForAnyYear(
	gregorian: CalendarDate,
): readonly Saint[] {
	const iso = toIso(gregorian);
	const windowHit = SAINTS_BY_ISO.get(iso);
	if (windowHit !== undefined) return windowHit;

	// Fixed cycle: look up by Julian month-day.
	const j = fromGregorian(gregorian);
	const fixedKey = `${String(j.month).padStart(2, "0")}-${String(j.day).padStart(2, "0")}`;
	const fixedHits = SAINT_FIXED_CYCLE.get(fixedKey) ?? [];

	// Movable cycle: look up by Pascha offset for this civil year.
	const pascha = getOrthodoxPascha(gregorian.year);
	const offset = diffG(gregorian, pascha);
	const movableHits = SAINT_MOVABLE_CYCLE.get(offset) ?? [];

	// ISO exceptions apply only within the vendored window (by definition
	// of their keying) so this returns empty outside it, which is correct:
	// cycle-unstable saints only have observations inside the window.
	const exceptionHits = SAINT_EXCEPTIONS.get(iso) ?? [];

	if (fixedHits.length === 0 && movableHits.length === 0 && exceptionHits.length === 0) {
		return [];
	}
	return [...fixedHits, ...movableHits, ...exceptionHits];
}

/**
 * Map HTOC rank glyph to Ponomar's numeric rank scale.
 *
 * HTOC's seven glyphs are: `"0"` (no sign), `"1"` (simple commemoration),
 * `"2"` (six-stichera, black bracket), `"3"` (doxology, red cross), `"4"`
 * (polyeleos, red cross w/ semicircle), `"5"` (vigil, red cross w/ semicircle
 * & dot), `"6"` (Great Feast, red sun), and `"o"` (octoechos / weekday).
 * Ponomar uses 0..8 where 6 = Great Feast of the Theotokos, 7 = Great Feast
 * of the Lord, 8 = Pascha; HTOC does not distinguish these top three, so
 * `"6"` is promoted to Ponomar 7 (Great Feast of the Lord) by convention.
 *
 * The returned value tracks upstream `<CHURCH Rank>` semantics closely
 * enough for `dRank`-gated code paths (matins-gospel eligibility, fasting
 * exemptions, service-template selection) to behave correctly.
 */
export function mapRank(glyph: string): number {
	switch (glyph) {
		case "6":
			return 7; // Great Feast (HTOC tops out at 6; promoted to GFotL)
		case "5":
			return 5; // Vigil
		case "4":
			return 4; // Polyeleos
		case "3":
			return 3; // Doxology
		case "2":
			return 2; // Six-stichera
		case "1":
			return 1; // Simple commemoration
		case "o":
			return 1; // Octoechos / weekday — same tier as simple
		case "0":
		default:
			return 0;
	}
}

/** Inverse of {@link mapRank}: Ponomar's 0..8 scale → HTOC glyph. Used
 *  when projecting Ponomar `ResolvedSaint`s into `Saint` shape for
 *  dates outside the vendored HTOC coverage window. Pascha (8) and the
 *  Great Feasts of the Lord/Theotokos (7/6) all collapse onto HTOC's top
 *  glyph `"6"`; the `"1"` / `"o"` distinction is also lost (both come from
 *  Ponomar 1 and we return `"1"`). */
export function unmapRank(rank: number): string {
	if (rank >= 6) return "6";
	if (rank === 5) return "5";
	if (rank === 4) return "4";
	if (rank === 3) return "3";
	if (rank === 2) return "2";
	if (rank === 1) return "1";
	return "0";
}

/** Max HTOC-derived rank across all saints on `gregorian` (0 if none). */
export function getDayRank(gregorian: CalendarDate): number {
	const saints = getSaintsFor(gregorian);
	if (saints === null) return 0;
	let max = 0;
	for (const s of saints) {
		const r = mapRank(s.rank);
		if (r > max) max = r;
	}
	return max;
}
