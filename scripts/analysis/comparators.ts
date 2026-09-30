// Shared comparators used by both `scripts/analysis/metrics.ts` (bulk report)
// and `tests/htoc.test.ts` (regression budgets). Kept intentionally simple:
// this is diagnostic infrastructure, not shipped runtime code.
//
// `compareCommemorations` does a greedy best-first token-set match between
// HTOC commemoration text and every ResolvedSaint's name fields (nominative,
// short, long, index). Matches with ≥2 shared non-stopword tokens count.
//
// `compareReadings` uses `parseBibleRef` to compare citations structurally,
// so "Galatians 4:4-7" and `Gal_4:4-7` are treated as the same reference.
//
// Neither comparator understands ordering or service classification —
// upstream analysis and downstream budgets handle that.

import type { BibleRef, VerseRange } from "../../src/bible/types.ts";
import { BibleRefError, parseBibleRef } from "../../src/bible/parse.ts";
import type { ReadingRef } from "../../src/engine/readings.ts";
import type { ResolvedSaint } from "../../src/engine/resolve.ts";
import type { HtocCommemoration, HtocScriptureReading } from "./corpus.ts";

const STOPWORDS = new Set([
	"the",
	"of",
	"and",
	"a",
	"an",
	"in",
	"at",
	"on",
	"to",
	"for",
	"our",
	"his",
	"her",
	"their",
	"who",
	"is",
	"was",
	"were",
	"be",
	"by",
	"with",
	"from",
	"as",
	"or",
	"but",
	"lord",
	"god",
	"most",
	"holy",
	"saint",
	"saints",
	"st",
	"sts",
	"venerable",
	"blessed",
	"righteous",
	"c",
	"century",
	"new",
	"repose",
	"translation",
	"relics",
	"movable",
	"holiday",
	"celebration",
	"greek",
	"celtic",
	"british",
	"russian",
]);

export function tokens(input: string): Set<string> {
	const cleaned = input
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/[\d(),.:;!?—–\-'`"“”]/g, " ")
		.toLowerCase();
	const out = new Set<string>();
	for (const raw of cleaned.split(/\s+/)) {
		const t = raw.trim();
		if (t.length < 3) continue;
		if (STOPWORDS.has(t)) continue;
		out.add(t);
	}
	return out;
}

export interface CommMatch {
	readonly htocIndex: number;
	readonly engineIndex: number;
	readonly overlap: number;
	readonly htocText: string;
	readonly engineName: string;
	readonly htocRank: string;
	readonly engineRank: number | undefined;
	readonly minor: boolean;
}

export interface CommResult {
	readonly htocCount: number;
	readonly engineCount: number;
	readonly matched: readonly CommMatch[];
	readonly htocOnly: readonly {
		readonly rank: string;
		readonly minor: boolean;
		readonly text: string;
	}[];
	readonly engineOnly: readonly {
		readonly cId: string;
		readonly rank: number | undefined;
		readonly name: string;
	}[];
}

function saintNameStrings(s: ResolvedSaint): string[] {
	const out: string[] = [];
	if (s.name?.nominative !== undefined) out.push(s.name.nominative);
	if (s.name?.short !== undefined) out.push(s.name.short);
	if (s.name?.long !== undefined) out.push(s.name.long);
	if (s.name?.index !== undefined) out.push(s.name.index);
	return out;
}

export function compareCommemorations(
	htoc: readonly HtocCommemoration[],
	engine: readonly ResolvedSaint[],
): CommResult {
	const htocTokens = htoc.map((c) => tokens(c.text));
	const engineTokens = engine.map((s) =>
		tokens(saintNameStrings(s).join(" ")),
	);
	interface Cand {
		hi: number;
		ei: number;
		overlap: number;
	}
	const cands: Cand[] = [];
	for (let hi = 0; hi < htoc.length; hi++) {
		const ht = htocTokens[hi]!;
		if (ht.size === 0) continue;
		for (let ei = 0; ei < engine.length; ei++) {
			const et = engineTokens[ei]!;
			if (et.size === 0) continue;
			let overlap = 0;
			for (const t of et) if (ht.has(t)) overlap++;
			if (overlap >= 2) cands.push({ hi, ei, overlap });
		}
	}
	cands.sort((a, b) => b.overlap - a.overlap);
	const usedHtoc = new Set<number>();
	const usedEngine = new Set<number>();
	const matched: CommMatch[] = [];
	for (const c of cands) {
		if (usedHtoc.has(c.hi) || usedEngine.has(c.ei)) continue;
		usedHtoc.add(c.hi);
		usedEngine.add(c.ei);
		const h = htoc[c.hi]!;
		const s = engine[c.ei]!;
		matched.push({
			htocIndex: c.hi,
			engineIndex: c.ei,
			overlap: c.overlap,
			htocText: h.text,
			engineName: saintNameStrings(s)[0] ?? "(anon)",
			htocRank: h.rank,
			engineRank: s.church?.rank,
			minor: h.minor,
		});
	}
	const htocOnly = htoc
		.map((c, i) => ({ i, c }))
		.filter(({ i }) => !usedHtoc.has(i))
		.map(({ c }) => ({ rank: c.rank, minor: c.minor, text: c.text }));
	const engineOnly = engine
		.map((s, i) => ({ i, s }))
		.filter(({ i }) => !usedEngine.has(i))
		.map(({ s }) => ({
			cId: s.cId,
			rank: s.church?.rank,
			name: saintNameStrings(s)[0] ?? "(anon)",
		}));
	return {
		htocCount: htoc.length,
		engineCount: engine.length,
		matched,
		htocOnly,
		engineOnly,
	};
}

export interface ReadingResult {
	readonly htocCount: number;
	readonly engineCount: number;
	readonly matched: number;
	readonly htocOnly: readonly {
		readonly citation: string;
		readonly note?: string;
	}[];
	readonly engineOnly: readonly {
		readonly source: string;
		readonly type: string;
		readonly service: string;
		readonly reading: string;
	}[];
}

function refKey(ref: BibleRef): string {
	if (ref.ranges.length === 0) return `${ref.book}|whole:${ref.chapter}`;
	const parts = ref.ranges.map((r: VerseRange) => {
		const s = `${r.start.chapter}:${r.start.verse}`;
		const e = `${r.end.chapter}:${r.end.verse}`;
		return `${s}-${e}`;
	});
	return `${ref.book}|${parts.join(",")}`;
}

/**
 * Parse an HTOC-style citation like `"II Peter 1:10-19"` or
 * `"Genesis 5:32-6:8"` into a `BibleRef`.
 *
 * HTOC / typical English rendering has quirks Ponomar's ref DSL does not
 * accept directly:
 *   - Multi-word book names use spaces (`II Peter`). Ponomar tolerates this
 *     because `parseBibleRef` looks up `BIBLE_BOOK_ALIASES["II Peter"]`.
 *   - Arabic-numeral prefixes (`1 Corinthians`, `2 Peter`, `3 John`) are
 *     translated to Roman for alias lookup.
 *   - Multi-chapter ranges use `;` (`Titus 2:11-14; 3:4-7`); Ponomar uses
 *     `,` to separate ranges.
 *   - Some HTOC pages drop the trailing `s` on plural book names
 *     (`Colossian 1:24-29`, `Ephesian 5:8`); we alias the singular forms.
 *   - HTOC occasionally renders a cross-chapter range with a redundant
 *     start-of-chapter marker (`Titus 1:15-2:1-10` = "1:15 through 2:10");
 *     we collapse the tri-part `-N:1-M` pattern to `-N:M`.
 *   - HTOC alternative-reading citations parenthesize the alternate
 *     (`John 20:1-10 (or Luke 24:36-53)`); we drop the parenthetical and
 *     keep the primary reference.
 */
export function tryParseCitation(citation: string): BibleRef | null {
	let cleaned = citation.trim().replace(/\s+/g, " ");
	cleaned = cleaned.replace(/\s*\(or [^)]+\)\s*$/i, "");
	cleaned = cleaned.replace(
		/^([123])\s+(?=[A-Z])/,
		(_m, n: string) => `${({ "1": "I", "2": "II", "3": "III" } as Record<string, string>)[n]!} `,
	);
	cleaned = cleaned.replace(/;\s*/g, ", ");
	cleaned = cleaned.replace(/^(Colossian|Ephesian|Philippian|Thessalonian|Galatian|Roman|Hebrew)(\s+\d)/i, "$1s$2");
	cleaned = cleaned.replace(/(\d):(\d+)-(\d+):1-(\d+)(?=\D|$)/g, "$1:$2-$3:$4");
	const m = /^(.+?)\s+(\d)/.exec(cleaned);
	if (m === null) return null;
	const book = m[1]!;
	const rest = cleaned.slice(m[1]!.length + 1);
	const candidate = `${book}_${rest}`;
	try {
		return parseBibleRef(candidate);
	} catch (e) {
		if (e instanceof BibleRefError) return null;
		throw e;
	}
}

export function compareReadings(
	htoc: readonly HtocScriptureReading[],
	engine: readonly ReadingRef[],
): ReadingResult {
	const htocKeys = htoc.map((r) => {
		const parsed = tryParseCitation(r.citation);
		return parsed === null ? null : refKey(parsed);
	});
	const engineKeys = engine.map((r) => {
		try {
			return refKey(parseBibleRef(r.reading));
		} catch (e) {
			if (e instanceof BibleRefError) return null;
			throw e;
		}
	});
	const usedEngine = new Set<number>();
	const matchedIndices = new Set<number>();
	// Allow one engine ref to satisfy multiple identical HTOC entries: HTOC
	// often lists the same reading under two different `note` tags when two
	// saints commemorated on the same day share it (e.g. Jan 2 Heb 4:14-5:6
	// is listed once for St John and again for Hieromartyr Ignatius). One
	// canonical engine emission covers both intentions.
	for (let hi = 0; hi < htoc.length; hi++) {
		const k = htocKeys[hi];
		if (k === null) continue;
		for (let ei = 0; ei < engine.length; ei++) {
			if (engineKeys[ei] === k) {
				usedEngine.add(ei);
				matchedIndices.add(hi);
				break;
			}
		}
	}
	const htocOnly = htoc
		.map((r, i) => ({ i, r }))
		.filter(({ i }) => !matchedIndices.has(i))
		.map(({ r }) =>
			r.note === undefined
				? { citation: r.citation }
				: { citation: r.citation, note: r.note },
		);
	const engineOnly = engine
		.map((r, i) => ({ i, r }))
		.filter(({ i }) => !usedEngine.has(i))
		.map(({ r }) => ({
			source: r.source,
			type: r.type,
			service: r.service,
			reading: r.reading,
		}));
	return {
		htocCount: htoc.length,
		engineCount: engine.length,
		matched: matchedIndices.size,
		htocOnly,
		engineOnly,
	};
}

/**
 * Structural equality on a single `ReadingRef` vs. an HTOC-style citation
 * string. Used by keystone-day tests where we assert exact refs.
 */
export function readingRefMatchesCitation(
	engine: ReadingRef,
	citation: string,
): boolean {
	const htoc = tryParseCitation(citation);
	if (htoc === null) return false;
	let engineRef: BibleRef;
	try {
		engineRef = parseBibleRef(engine.reading);
	} catch {
		return false;
	}
	return refKey(engineRef) === refKey(htoc);
}
