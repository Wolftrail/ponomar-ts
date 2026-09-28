// Barrel for the Bible reference parser + book registry.
//
// The generated book registry lives in `src/data/bibleBooks.ts`; this
// folder wraps it with the runtime parser and a small formatter.

export type { BibleBook, BibleRef, VerseEndpoint, VerseRange } from "./types.ts";
export { BibleRefError, parseBibleRef } from "./parse.ts";
export { findBook, formatBibleRef } from "./format.ts";
export { BIBLE_BOOKS, BIBLE_BOOK_ALIASES } from "../data/index.ts";
