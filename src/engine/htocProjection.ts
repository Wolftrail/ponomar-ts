// Project HTOC's published commemoration list into `ResolvedSaint`-shaped
// records so that `LiturgicalDay.allSaints` is HTOC-authoritative. See
// `src/engine/index.ts` for how this feeds the public API.
//
// Each HTOC commemoration carries its own rank glyph and (optionally)
// life-page slugs; the Ponomar structural lists (`paschalSaints`,
// `menaionSaints`) remain untouched for propers lookup and tone semantics.

import type { HtocCommemoration } from "../data/htocDayFacts.ts";
import { mapHtocRank } from "./htocSaints.ts";
import type { ResolvedSaint } from "./resolve.ts";

/** Deterministically map an HTOC commemoration list onto `ResolvedSaint[]`.
 *  Order is preserved. Synthetic `cId`s are prefixed with `htoc:` so they
 *  never collide with Ponomar's numeric cIds, and are stable across days
 *  (same commemoration ⇒ same cId). */
export function projectHtocCommemorations(
	commemorations: readonly HtocCommemoration[],
): ResolvedSaint[] {
	const out: ResolvedSaint[] = [];
	const seen = new Map<string, number>();
	for (const c of commemorations) {
		const base = synthesizeCId(c);
		const n = (seen.get(base) ?? 0) + 1;
		seen.set(base, n);
		const cId = n === 1 ? base : `${base}-${n}`;
		const rank = mapHtocRank(c.rank);
		out.push({
			sIds: [],
			cId,
			tone: null,
			name: { nominative: c.text },
			church: { rank },
		});
	}
	return out;
}

function synthesizeCId(c: HtocCommemoration): string {
	const firstLife = c.lives[0];
	if (firstLife !== undefined && firstLife.slug.length > 0) {
		return `htoc:${firstLife.slug}`;
	}
	return `htoc:anon:${slugify(c.text)}`;
}

// ASCII-fold + collapse to [a-z0-9-]. Non-ASCII characters are dropped (the
// synthetic cId is a stable key, not a display string). Max length keeps
// the cId readable and bounded.
function slugify(text: string): string {
	const lower = text.toLowerCase();
	let out = "";
	for (const ch of lower) {
		const code = ch.charCodeAt(0);
		if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57)) {
			out += ch;
		} else if (out.length > 0 && !out.endsWith("-")) {
			out += "-";
		}
	}
	if (out.endsWith("-")) out = out.slice(0, -1);
	return out.length === 0 ? "unnamed" : out.slice(0, 64);
}
