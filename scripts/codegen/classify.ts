// Shared classifier for HTOC commemoration decomposition. Operates on the
// level of (occurrence) tuples, not deduplicated groups, so multi-day
// fixed feasts (e.g. Forefeast of the Nativity on Julian Dec 21-24) are
// correctly classified as fixed on each of their component Julian dates.
//
// For each unique commemoration (text + lives), classification is:
//
//   paschal-movable: appears at MULTIPLE Julian MM-DDs across the corpus but
//                    at a SINGLE nday — the Julian date is a function of the
//                    paschalion, the nday is the real anchor.
//   dow-shift:       appears at multiple Julian MM-DDs AND multiple ndays
//                    (DOW-nearest-Julian-date patterns).
//   season-synth:    season-driven marker synthesized at runtime.
//   transferred:     per-year "transferred from X to this day" composite.
//   fixed-julian:    everything else — includes multi-day fixed feasts.

import { DAY_FACTS_BY_ISO } from "../../src/engine/dayFacts.ts";
import type { Commemoration } from "../../src/data/dayFacts.ts";
import { computeDayContext } from "../../src/engine/day.ts";

export const SEASON_SYNTHESIZED: readonly RegExp[] = [
	/^Clean Monday\.$/,
	/^From December 25 till January 5 is a Fast-free period/,
	/^Beginning of Apostles'/,
	/^Beginning of the Dormition Fast/,
	/^Beginning of Nativity Fast/,
	/^Beginning of the Nativity Fast/,
];

export const TRANSFERRED_COMPOSITE: readonly RegExp[] = [
	/is transferred from .+ to this day\.?$/,
];

export type Classification =
	| "fixed-julian"
	| "paschal-movable"
	| "dow-shift"
	| "season-synth"
	| "transferred";

export interface Occurrence {
	readonly iso: string;
	readonly year: number;
	readonly julianKey: string;
	readonly nday: number;
	readonly commem: Commemoration;
}

export interface ClassifiedOccurrence extends Occurrence {
	readonly classification: Classification;
}

function textKey(c: Commemoration): string {
	// Normalize interior whitespace so variants like "September 3rd" and
	// "September 3 rd" land in a single group (otherwise a 1-occurrence
	// whitespace variant looks like a fixed-julian 1×1 feast).
	const normText = c.text
		.replace(/\s+/g, " ")
		.replace(/(\d)\s+(st|nd|rd|th)\b/gi, "$1$2")
		.trim();
	return `${c.rank}|${c.minor ? 1 : 0}|${normText}|${c.lives.map((l) => l.slug).join(",")}`;
}

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
	return patterns.some((re) => re.test(text));
}

/**
 * Classify every occurrence of every commemoration in the vendored corpus.
 * Returns one entry per raw occurrence (so a 3-year-stable commemoration
 * contributes 3 entries, each with the same classification).
 */
export function classifyAll(): ClassifiedOccurrence[] {
	const occurrences: Occurrence[] = [];
	for (const [iso, facts] of DAY_FACTS_BY_ISO) {
		const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
		const ctx = computeDayContext({ year: y, month: m, day: d });
		const jkey = `${String(ctx.julian.month).padStart(2, "0")}-${String(ctx.julian.day).padStart(2, "0")}`;
		for (const c of facts.commemorations) {
			occurrences.push({ iso, year: y, julianKey: jkey, nday: ctx.nday, commem: c });
		}
	}

	const textGroups = new Map<string, Occurrence[]>();
	for (const o of occurrences) {
		const k = textKey(o.commem);
		if (!textGroups.has(k)) textGroups.set(k, []);
		textGroups.get(k)!.push(o);
	}

	const textClass = new Map<string, Classification>();
	for (const [k, group] of textGroups) {
		const sample = group[0]!.commem.text;
		if (matchesAny(sample, SEASON_SYNTHESIZED)) {
			textClass.set(k, "season-synth");
			continue;
		}
		if (matchesAny(sample, TRANSFERRED_COMPOSITE)) {
			textClass.set(k, "transferred");
			continue;
		}
		// HTOC self-identifies movable entries with a "movable" parenthetical.
		// Protect these from accidental fixed-julian classification caused by
		// 1-year/1-key singletons (sometimes HTOC drops the parenthetical in
		// other years' listings or shifts the rank, splitting the text group).
		const isSelfDescribedMovable = /\bmovable\b/i.test(sample);
		const julianKeys = new Set(group.map((o) => o.julianKey));
		const ndays = new Set(group.map((o) => o.nday));
		const years = new Set(group.map((o) => o.year));
		// Dedupe to one entry per (year, julianKey) pair so upstream duplicate
		// listings on a single day don't throw off the stability math.
		const yearJulianPairs = new Set(group.map((o) => `${o.year}|${o.julianKey}`));
		// Multi-day fixed feasts: every (year × julianKey) combination is
		// occupied. Includes the single-Julian case (julianKeys.size===1) and
		// shared-text-across-saints case (one entry per date per year).
		if (!isSelfDescribedMovable && yearJulianPairs.size === years.size * julianKeys.size) {
			textClass.set(k, "fixed-julian");
			continue;
		}
		// Paschal/triodion-anchored: one occurrence per year, same nday, but
		// the Julian date shifts with the paschalion.
		if (ndays.size === 1 && julianKeys.size > 1) {
			textClass.set(k, "paschal-movable");
			continue;
		}
		// Everything else varies in both axes — DOW-nearest-Julian or
		// per-year transferred composites.
		textClass.set(k, "dow-shift");
	}

	return occurrences.map((o) => ({ ...o, classification: textClass.get(textKey(o.commem))! }));
}
