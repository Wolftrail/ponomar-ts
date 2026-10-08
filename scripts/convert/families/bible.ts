// Converts the book catalogue of languages/xml/bible.xml. Translation registries, formatting rules and Bible text are not shipped.
import type { BibleBook } from "../../../src/data/types.ts";
import { type GeneratedFile, header, literal } from "../emit.ts";
import { attributes, children } from "../schema.ts";
import { readXml, sourcePath } from "../sources.ts";

const OUTPUT = "src/data/generated/bibleBooks.ts";

/** The translation whose names, short forms and chapter counts are the reference. */
const REFERENCE = "en/bible/kjv";

export function convertBibleBooks(): GeneratedFile[] {
	const where = sourcePath("", "bible.xml");
	const versions = children(readXml("", "bible.xml"), ["BIBLE"], where);
	const books = (id: string) => {
		const version = versions.find((v) => v.attributes["Id"] === id);
		if (version === undefined) {
			throw new Error(`${where}: no <BIBLE Id="${id}">`);
		}
		return children(version, ["INFO", "BOOK"], where).filter((child) => child.name === "BOOK");
	};

	const chapterCounts = new Map<string, Set<number>>();
	const firstSeen: string[] = [];
	const firstDefinition = new Map<string, Readonly<Record<string, string>>>();
	for (const version of versions) {
		for (const book of books(version.attributes["Id"]!)) {
			const attrs = attributes(book, ["Id", "Name", "Chapters", "Short", "Intro", "Source", "Note", "Notes"], where, ["Id", "Chapters"]);
			const chapters = Number(attrs["Chapters"]);
			if (!Number.isInteger(chapters) || chapters < 1) {
				throw new Error(`${where}: book ${attrs["Id"]} has chapter count "${attrs["Chapters"]}"`);
			}
			if (!chapterCounts.has(attrs["Id"]!)) {
				chapterCounts.set(attrs["Id"]!, new Set());
				firstSeen.push(attrs["Id"]!);
				firstDefinition.set(attrs["Id"]!, attrs);
			}
			chapterCounts.get(attrs["Id"]!)!.add(chapters);
		}
	}

	const reference = new Map(books(REFERENCE).map((book) => [book.attributes["Id"]!, book.attributes]));
	const catalogue: BibleBook[] = firstSeen.map((id) => {
		// A book the reference translation lacks (IV_Macc) takes its details from the first translation that has it.
		const attrs = reference.get(id) ?? firstDefinition.get(id)!;
		const name = attrs["Name"] ?? id.replaceAll("_", " ");
		const primary = Number(attrs["Chapters"]);
		const alternatives = [...chapterCounts.get(id)!].filter((count) => count !== primary).sort((a, b) => a - b);
		return {
			id,
			name,
			short: attrs["Short"] ?? name,
			chapters: primary,
			...(alternatives.length > 0 ? { alternativeChapters: alternatives } : {}),
		};
	});

	return [
		{
			path: OUTPUT,
			content:
				header(where, 'import type { BibleBook } from "../types.ts";') +
				`/** Every book id declared in bible.xml, in the order the translations first list them; "Composite" is a pseudo-book for combined readings. */\nexport const BIBLE_BOOKS: readonly BibleBook[] = ${literal(catalogue)};\n`,
		},
	];
}
