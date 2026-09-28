// Parse a Ponomar scripture reference string into a structured `BibleRef`.
//
// Ported from the reference-handling paths in `Ponomar/Bible.java`. The
// upstream string form appears in `Reading=` attributes on `<SCRIPTURE>`
// elements and in `Verses=` attributes on `<BIBLE>` directives inside
// service templates. Grammar (informal):
//
//   Ref       ::= BookRef "_" Chapter ( ":" VerseSpec )?
//   BookRef   ::= identifier (a book `Id`, `Short`, or `Name`)
//   VerseSpec ::= Range ( ","+ WS* Range )*
//   Range     ::= Endpoint ( "-" Endpoint )?
//   Endpoint  ::= ( Chapter ":" )? Verse Part?
//   Part      ::= "a" | "b" | "c"
//
// The `_` is the LAST underscore in the input — the book portion may
// itself contain underscores (`I_Tim_4:5-8`) or spaces (`I Tim_4:5-8`).

import { BIBLE_BOOK_ALIASES, BIBLE_BOOKS } from "../data/index.ts";
import type { BibleRef, VerseEndpoint, VerseRange } from "./types.ts";

export class BibleRefError extends Error {
	readonly input: string;
	constructor(input: string, message: string) {
		super(`Invalid Bible ref ${JSON.stringify(input)}: ${message}`);
		this.name = "BibleRefError";
		this.input = input;
	}
}

export function parseBibleRef(input: string): BibleRef {
	const trimmed = input.trim();
	if (trimmed.length === 0) {
		throw new BibleRefError(input, "empty");
	}
	const sep = trimmed.lastIndexOf("_");
	if (sep < 1 || sep === trimmed.length - 1) {
		throw new BibleRefError(input, "missing `_` between book and chapter");
	}
	const rawBook = trimmed.slice(0, sep);
	const rest = trimmed.slice(sep + 1);
	const book = resolveBook(rawBook);
	if (book === undefined) {
		throw new BibleRefError(input, `unknown book ${JSON.stringify(rawBook)}`);
	}

	const colon = rest.indexOf(":");
	const chapterStr = colon < 0 ? rest : rest.slice(0, colon);
	const chapter = parsePositiveInt(chapterStr, input, "chapter");
	if (chapter > book.chapters) {
		throw new BibleRefError(
			input,
			`chapter ${chapter} out of range (${book.name} has ${book.chapters})`,
		);
	}
	const ranges: VerseRange[] =
		colon < 0 ? [] : parseVerseSpec(rest.slice(colon + 1), chapter, input);
	return {
		book: book.id,
		bookName: book.name,
		bookShort: book.short,
		bookLabel: rawBook.trim(),
		chapter,
		ranges,
	};
}

function resolveBook(raw: string) {
	const trimmed = raw.trim();
	const id = BIBLE_BOOK_ALIASES[trimmed];
	if (id !== undefined) return BIBLE_BOOKS[id];
	return undefined;
}

function parseVerseSpec(
	spec: string,
	primaryChapter: number,
	input: string,
): VerseRange[] {
	const trimmed = spec.trim();
	if (trimmed.length === 0) {
		throw new BibleRefError(input, "empty verse spec after `:`");
	}
	const rawRanges = trimmed.split(",").map((r) => r.trim()).filter((r) => r.length > 0);
	if (rawRanges.length === 0) {
		throw new BibleRefError(input, "no verse ranges");
	}
	const out: VerseRange[] = [];
	let contextChapter = primaryChapter;
	for (const raw of rawRanges) {
		const range = parseRange(raw, contextChapter, input);
		out.push(range);
		contextChapter = range.end.chapter;
	}
	return out;
}

function parseRange(
	raw: string,
	contextChapter: number,
	input: string,
): VerseRange {
	const dash = raw.indexOf("-");
	if (dash < 0) {
		const ep = parseEndpoint(raw, contextChapter, input);
		return { start: ep, end: ep };
	}
	const start = parseEndpoint(raw.slice(0, dash), contextChapter, input);
	const end = parseEndpoint(raw.slice(dash + 1), start.chapter, input);
	return { start, end };
}

function parseEndpoint(
	raw: string,
	contextChapter: number,
	input: string,
): VerseEndpoint {
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		throw new BibleRefError(input, "empty endpoint");
	}
	const colon = trimmed.indexOf(":");
	if (colon >= 0) {
		const chap = parsePositiveInt(trimmed.slice(0, colon), input, "chapter");
		return parseVersePart(trimmed.slice(colon + 1), chap, input);
	}
	return parseVersePart(trimmed, contextChapter, input);
}

function parseVersePart(
	raw: string,
	chapter: number,
	input: string,
): VerseEndpoint {
	const m = /^(\d+)([abc])?$/.exec(raw.trim());
	if (m === null) {
		throw new BibleRefError(input, `invalid verse ${JSON.stringify(raw)}`);
	}
	const verse = Number.parseInt(m[1]!, 10);
	if (!Number.isFinite(verse) || verse <= 0) {
		throw new BibleRefError(input, `invalid verse ${JSON.stringify(raw)}`);
	}
	const part = m[2] as "a" | "b" | "c" | undefined;
	return {
		chapter,
		verse,
		...(part !== undefined ? { part } : {}),
	};
}

function parsePositiveInt(raw: string, input: string, label: string): number {
	const n = Number.parseInt(raw.trim(), 10);
	if (!Number.isFinite(n) || n <= 0 || String(n) !== raw.trim()) {
		throw new BibleRefError(input, `invalid ${label} ${JSON.stringify(raw)}`);
	}
	return n;
}
