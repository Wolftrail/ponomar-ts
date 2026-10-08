import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { findDrift } from "../../scripts/convert/emit.ts";
import { convertBibleBooks } from "../../scripts/convert/families/bible.ts";
import { xmlDir } from "../../scripts/convert/sources.ts";
import { BIBLE_BOOKS } from "../../src/data/generated/bibleBooks.ts";

test("book catalogue lists every id in bible.xml once", () => {
	const text = readFileSync(join(xmlDir(""), "bible.xml"), "utf8");
	const ids = new Set([...text.matchAll(/<BOOK\s+Id="([^"]*)"/g)].map((m) => m[1]));
	assert.equal(BIBLE_BOOKS.length, ids.size);
	assert.deepEqual(new Set(BIBLE_BOOKS.map((b) => b.id)), ids);
});

test("book catalogue keeps reference names, chapter counts and variants", () => {
	const book = (id: string) => BIBLE_BOOKS.find((b) => b.id === id);
	assert.deepEqual(book("Gen"), { id: "Gen", name: "Genesis", short: "Gen", chapters: 50 });
	assert.deepEqual(book("Prov")?.alternativeChapters, [28]);
	assert.deepEqual(book("Sirach")?.alternativeChapters, [52]);
	assert.equal(book("IV_Macc")?.name, "IV Maccabees");
	assert.equal(book("I_Cor")?.chapters, 16);
	assert.equal(book("Psalm")?.chapters, 151);
});

test("no Bible text ships: only the catalogue is generated", () => {
	const generated = fileURLToPath(new URL("../../src/data/generated/", import.meta.url));
	assert.ok(readdirSync(generated).includes("bibleBooks.ts"));
	assert.ok(!readFileSync(join(generated, "bibleBooks.ts"), "utf8").includes("In the beginning"));
	assert.ok(!readdirSync(generated, { recursive: true }).some((name) => String(name).endsWith(".text")));
});

test("book catalogue is up to date", () => {
	assert.deepEqual(findDrift(convertBibleBooks()), []);
});
