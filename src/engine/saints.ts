// Saint-centric API — translates between HTOC slugs and Ponomar cIds,
// and gathers everything the UI needs for a /saints/<id> route into one
// shape. HTOC is the public identity (slug); Ponomar's cId stays as an
// internal implementation detail used to join to the lives corpus.

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { HTOC_SAINTS_BY_ISO } from "../data/htocSaints.ts";
import type { HtocSaint } from "../data/htocSaints.ts";
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
	/** Every Gregorian date in the vendored HTOC window (2025–2027) where
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
	for (const [iso, saints] of HTOC_SAINTS_BY_ISO) {
		const entry = saints.find((s: HtocSaint) => s.slug === slug);
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
