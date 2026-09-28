// Parse the `<BIBLE Id="en/bible/kjv">` block of
// `vendor/ponomar/Ponomar/languages/xml/bible.xml` and return the list of
// `<BOOK>` entries. Other language / version blocks (Brenton, French,
// Church Slavonic, Latin, Chinese …) are ignored: the reference parser
// under `src/bible/` only needs the canonical English full-Bible metadata.

import { readFileSync } from "node:fs";
import type { BibleBook } from "../../src/data/types.ts";
import { elementChildren, parseXml } from "./xml.ts";

const EN_KJV_ID = "en/bible/kjv";

export function parseBibleBooks(file: string): BibleBook[] {
	const src = readFileSync(file, "utf8");
	const root = parseXml(src);
	for (const bible of elementChildren(root)) {
		if (bible.tag !== "BIBLE") continue;
		if (bible.attrs["Id"] !== EN_KJV_ID) continue;
		return elementChildren(bible)
			.filter((c) => c.tag === "BOOK")
			.map(bookFromElement);
	}
	throw new Error(`${file}: <BIBLE Id="${EN_KJV_ID}"> block not found`);
}

function bookFromElement(el: { attrs: Readonly<Record<string, string>> }): BibleBook {
	const id = required(el.attrs, "Id");
	const name = required(el.attrs, "Name");
	const short = required(el.attrs, "Short");
	const chaptersRaw = required(el.attrs, "Chapters");
	const chapters = Number.parseInt(chaptersRaw, 10);
	if (!Number.isFinite(chapters) || chapters <= 0) {
		throw new Error(`<BOOK Id=${id}>: invalid Chapters=${chaptersRaw}`);
	}
	const intro = el.attrs["Intro"];
	return {
		id,
		name,
		short,
		chapters,
		...(intro !== undefined && intro.length > 0 ? { intro } : {}),
	};
}

function required(attrs: Readonly<Record<string, string>>, key: string): string {
	const v = attrs[key];
	if (v === undefined) {
		throw new Error(`<BOOK>: missing required attribute ${key}`);
	}
	return v;
}
