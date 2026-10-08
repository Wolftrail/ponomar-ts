// Parses the scripture references in Ponomar's data ("Lk_2:20-21, 40-52") into structured ranges.
// Upstream interprets these strings inside its Swing Bible window; this is a new implementation of the notation.
// No Bible text is involved: consumers supply the text and use the ranges to look it up.

import { BIBLE_BOOKS } from "../data/generated/bibleBooks.ts";
import type { BibleBook } from "../data/types.ts";

const BY_ID: ReadonlyMap<string, BibleBook> = new Map(BIBLE_BOOKS.map((book) => [book.id, book]));

/** The catalogue entry for a book id; readings write numbered books with a space ("I Cor"), the catalogue with an underscore. */
export function findBibleBook(name: string): BibleBook | undefined {
	return BY_ID.get(name.trim().replace(/\s+/g, "_"));
}

export class BibleReferenceError extends Error {
	override name = "BibleReferenceError";
}

/** A point in a book: a chapter, optionally a verse, optionally a lettered part of the verse ("a", "b"). */
export interface VerseEndpoint {
	readonly chapter: number;
	readonly verse?: number;
	readonly part?: string;
}

/** `from` to `to`, inclusive. A whole chapter has no verse on either end. */
export interface VerseRange {
	readonly from: VerseEndpoint;
	readonly to: VerseEndpoint;
}

export interface BibleReference {
	/** Id in the book catalogue, e.g. "I_Cor". */
	readonly book: string;
	readonly ranges: readonly VerseRange[];
}

// An item is "[C:]V[p]" or "[C:]V[p]-[C:]V[p]"; a bare number with no chapter in force is a whole chapter.
const ITEM = /^(?:(\d+):)?(\d+)([a-z])?(?:-(?:(\d+):)?(\d+)([a-z])?)?$/;

function endpoint(chapter: number, verse: number, part: string | undefined): VerseEndpoint {
	return part === undefined ? { chapter, verse } : { chapter, verse, part };
}

function inOrder(from: VerseEndpoint, to: VerseEndpoint): boolean {
	if (from.chapter !== to.chapter) {
		return from.chapter < to.chapter;
	}
	return (from.verse ?? 0) <= (to.verse ?? 0);
}

export function parseBibleReference(text: string): BibleReference {
	// The book ends at the underscore before the chapter, so "I Cor_12:27" and "I_Cor_12:27" both read.
	const split = /^(.+?)_(\d.*)$/.exec(text);
	if (split === null) {
		throw new BibleReferenceError(`"${text}" has no book and chapter`);
	}
	const bookName = split[1]!;
	const book = findBibleBook(bookName);
	if (book === undefined) {
		throw new BibleReferenceError(`unknown book "${bookName}" in "${text}"`);
	}
	const lastChapter = Math.max(book.chapters, ...(book.alternativeChapters ?? []));

	const ranges: VerseRange[] = [];
	let chapter: number | undefined;
	for (const raw of split[2]!.split(",")) {
		const item = ITEM.exec(raw.trim());
		if (item === null) {
			throw new BibleReferenceError(`cannot read "${raw.trim()}" in "${text}"`);
		}
		const [, chapterA, numberA, partA, chapterB, numberB, partB] = item;
		let from: VerseEndpoint;
		let to: VerseEndpoint;
		if (chapterA === undefined && chapter === undefined) {
			if (partA !== undefined || numberB !== undefined) {
				throw new BibleReferenceError(`"${raw.trim()}" in "${text}" needs a chapter`);
			}
			from = to = { chapter: Number(numberA) };
			chapter = undefined;
		} else {
			from = endpoint(chapterA === undefined ? chapter! : Number(chapterA), Number(numberA), partA);
			to = numberB === undefined ? from : endpoint(chapterB === undefined ? from.chapter : Number(chapterB), Number(numberB), partB);
			chapter = to.chapter;
		}
		for (const point of [from, to]) {
			if (point.chapter < 1 || point.chapter > lastChapter || (point.verse !== undefined && point.verse < 1)) {
				throw new BibleReferenceError(`${book.id} has no chapter ${point.chapter}, verse ${point.verse ?? "-"} (in "${text}")`);
			}
		}
		if (!inOrder(from, to)) {
			throw new BibleReferenceError(`range runs backwards in "${text}"`);
		}
		ranges.push({ from, to });
	}
	return { book: book.id, ranges };
}

/** The reference in the notation of the data: "Lk_2:20-21, 40-52" and "I Cor_1:18"; chapters are written only where they change. */
export function formatBibleReference(reference: BibleReference): string {
	let chapter: number | undefined;
	const point = (p: VerseEndpoint, withChapter: boolean): string => `${withChapter ? `${p.chapter}:` : ""}${p.verse}${p.part ?? ""}`;
	const items = reference.ranges.map(({ from, to }) => {
		if (from.verse === undefined) {
			chapter = undefined;
			return String(from.chapter);
		}
		const first = point(from, from.chapter !== chapter);
		const single = from.chapter === to.chapter && from.verse === to.verse && from.part === to.part;
		const text = single ? first : `${first}-${point(to, to.chapter !== from.chapter)}`;
		chapter = to.chapter;
		return text;
	});
	return `${reference.book.replaceAll("_", " ")}_${items.join(", ")}`;
}
