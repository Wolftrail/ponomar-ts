// Public types for `src/bible/`. The runtime parser + book registry live
// in this folder; scripture text lives wherever a consumer chooses.

import type { BibleBook } from "../data/types.ts";

export type { BibleBook };

/** One endpoint of a verse range. Half-verse markers (`a` / `b` / `c`)
 *  are preserved when present. */
export interface VerseEndpoint {
	readonly chapter: number;
	readonly verse: number;
	readonly part?: "a" | "b" | "c";
}

/** A contiguous span of verses. Single-verse spans have `start === end`
 *  (structurally equal; not the same object). */
export interface VerseRange {
	readonly start: VerseEndpoint;
	readonly end: VerseEndpoint;
}

/** One fully-parsed scripture reference from a `Reading=` / `Verses=`
 *  attribute (e.g. `"II Tim_4:5-8"`, `"Psalm_5"`, `"Rom_13:11b-14:4"`). */
export interface BibleRef {
	/** Canonical book id from `BIBLE_BOOKS` (e.g. `"II_Tim"`). */
	readonly book: string;
	/** Book display name (e.g. `"II Timothy"`). */
	readonly bookName: string;
	/** Book short abbreviation (e.g. `"II Tim"`). */
	readonly bookShort: string;
	/** The exact book token as it appeared in the source string. Preserved
	 *  so `formatBibleRef(parseBibleRef(x)) === x` for corpus inputs. */
	readonly bookLabel: string;
	/** Primary chapter — the one after the underscore. */
	readonly chapter: number;
	/** Verse ranges, in the order they appeared in the source string.
	 *  Empty when the reference names only a whole chapter (e.g. `"Psalm_5"`). */
	readonly ranges: readonly VerseRange[];
}
