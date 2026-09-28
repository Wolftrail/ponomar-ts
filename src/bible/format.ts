// Small helpers around `BIBLE_BOOKS`: alias lookup and canonical
// string formatting for a parsed `BibleRef`.

import { BIBLE_BOOK_ALIASES, BIBLE_BOOKS } from "../data/index.ts";
import type { BibleBook, BibleRef, VerseEndpoint, VerseRange } from "./types.ts";

/** Look up a book by any accepted form (`Id`, `Short`, `Name`, or
 *  `Short`-with-underscores). Returns `undefined` when unknown. */
export function findBook(nameOrShort: string): BibleBook | undefined {
	const id = BIBLE_BOOK_ALIASES[nameOrShort.trim()];
	if (id === undefined) return undefined;
	return BIBLE_BOOKS[id];
}

/** Format a `BibleRef` back to the upstream `<Label>_<Chapter>:<Spec>` form.
 *  Uses the original `bookLabel` from the parsed input, so
 *  `formatBibleRef(parseBibleRef(x)) === x` for every corpus reference. */
export function formatBibleRef(ref: BibleRef): string {
	if (ref.ranges.length === 0) {
		return `${ref.bookLabel}_${ref.chapter}`;
	}
	const spec = ref.ranges.map((r) => formatRange(r, ref.chapter)).join(", ");
	return `${ref.bookLabel}_${ref.chapter}:${spec}`;
}

function formatRange(range: VerseRange, primaryChapter: number): string {
	const startStr = formatEndpoint(range.start, primaryChapter, /*explicitChapter*/ false);
	if (range.start.chapter === range.end.chapter
		&& range.start.verse === range.end.verse
		&& range.start.part === range.end.part) {
		return startStr;
	}
	const endStr = formatEndpoint(
		range.end,
		range.start.chapter,
		range.end.chapter !== range.start.chapter,
	);
	return `${startStr}-${endStr}`;
}

function formatEndpoint(
	ep: VerseEndpoint,
	contextChapter: number,
	forceChapter: boolean,
): string {
	const needChapter = forceChapter || ep.chapter !== contextChapter;
	const prefix = needChapter ? `${ep.chapter}:` : "";
	const part = ep.part ?? "";
	return `${prefix}${ep.verse}${part}`;
}
