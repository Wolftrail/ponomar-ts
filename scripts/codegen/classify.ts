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
	// For fixed-julian entries whose text group spans a Julian Feb 28 ↔ Feb 29
	// (leap-year transfer) pattern: "leap" means emit only on Julian leap
	// years, "non-leap" only on non-leap years, undefined means always emit.
	readonly leapScope?: "leap" | "non-leap";
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
 * Returns one entry per raw occurrence (so a corpus-stable commemoration
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

	const allCorpusYears = [...new Set(occurrences.map((o) => o.year))].sort();
	const corpusLeap = new Set(allCorpusYears.filter((y) => y % 4 === 0));
	const corpusNonLeap = new Set(allCorpusYears.filter((y) => y % 4 !== 0));

	const textGroups = new Map<string, Occurrence[]>();
	for (const o of occurrences) {
		const k = textKey(o.commem);
		if (!textGroups.has(k)) textGroups.set(k, []);
		textGroups.get(k)!.push(o);
	}

	const textClass = new Map<string, Classification>();
	// For split-julian text groups, per-julianKey leap scope.
	const textLeapScopes = new Map<string, Map<string, "any" | "leap" | "non-leap">>();
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
		// Require either multi-year coverage or multi-day span to prevent
		// single-year composites (e.g. "transferred to Thursday, June 1" one-off
		// annotations, DOW-shift headers that happened to land in only one
		// corpus year) from being locked to a fixed Julian date and emitted
		// for every future year.
		const multiYearOrMultiDay = years.size >= 2 || julianKeys.size >= 2;
		if (!isSelfDescribedMovable && multiYearOrMultiDay && yearJulianPairs.size === years.size * julianKeys.size) {
			textClass.set(k, "fixed-julian");
			continue;
		}
		// Paschal/triodion-anchored: one occurrence per year, same nday, but
		// the Julian date shifts with the paschalion.
		if (ndays.size === 1 && julianKeys.size > 1) {
			textClass.set(k, "paschal-movable");
			continue;
		}
		// Split-julian: the text group spans multiple Julian keys where each
		// key's year coverage matches a Julian leap-year predicate. The
		// canonical case is a commemoration anchored to Julian Feb 29 that
		// HTOC transfers to Feb 28 in non-leap Julian years (10+ saints in
		// the vendored corpus). Also catches "primary date + Feb 29 transfer"
		// composites (e.g. St. Theosterictus on Mar 17 Julian + Feb 28/29).
		const scopes = detectLeapScopes(group, allCorpusYears, corpusLeap, corpusNonLeap);
		if (scopes !== null) {
			textClass.set(k, "fixed-julian");
			textLeapScopes.set(k, scopes);
			continue;
		}
		// Everything else varies in both axes — DOW-nearest-Julian or
		// per-year transferred composites.
		textClass.set(k, "dow-shift");
	}

	return occurrences.map((o) => {
		const tk = textKey(o.commem);
		const cls = textClass.get(tk)!;
		const scopes = textLeapScopes.get(tk);
		const scope = scopes?.get(o.julianKey);
		if (scope === "leap" || scope === "non-leap") {
			return { ...o, classification: cls, leapScope: scope };
		}
		return { ...o, classification: cls };
	});
}

/**
 * Detect split-julian pattern: the text group is covered by a set of julian
 * keys where each key's observed year set matches "all corpus years",
 * "all leap years in corpus", or "all non-leap years in corpus". Returns
 * the per-key scope map, or null if the group doesn't fit the pattern.
 */
function detectLeapScopes(
	group: readonly Occurrence[],
	allCorpusYears: readonly number[],
	corpusLeap: ReadonlySet<number>,
	corpusNonLeap: ReadonlySet<number>,
): Map<string, "any" | "leap" | "non-leap"> | null {
	const perKey = new Map<string, Set<number>>();
	for (const o of group) {
		if (!perKey.has(o.julianKey)) perKey.set(o.julianKey, new Set());
		perKey.get(o.julianKey)!.add(o.year);
	}
	// Dedupe to one occurrence per (year, key) pair; refuse ambiguous groups
	// with multiple same-day same-text entries.
	let totalPairs = 0;
	for (const years of perKey.values()) totalPairs += years.size;
	if (totalPairs !== group.length) return null;
	const scopes = new Map<string, "any" | "leap" | "non-leap">();
	for (const [jk, obsYears] of perKey) {
		if (allCorpusYears.every((y) => obsYears.has(y))) {
			scopes.set(jk, "any");
		} else if (
			corpusLeap.size > 0
			&& [...obsYears].every((y) => corpusLeap.has(y))
			&& [...corpusLeap].every((y) => obsYears.has(y))
		) {
			scopes.set(jk, "leap");
		} else if (
			corpusNonLeap.size > 0
			&& [...obsYears].every((y) => corpusNonLeap.has(y))
			&& [...corpusNonLeap].every((y) => obsYears.has(y))
		) {
			scopes.set(jk, "non-leap");
		} else {
			return null;
		}
	}
	return scopes;
}
