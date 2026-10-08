import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { LANGUAGES, listFiles, xmlDir } from "../../scripts/convert/sources.ts";
import { BibleReferenceError, findBibleBook, formatBibleReference, parseBibleReference } from "../../src/bible/reference.ts";

test("parses chapters, verses, parts and ranges", () => {
	assert.deepEqual(parseBibleReference("Mt_5:3"), { book: "Mt", ranges: [{ from: { chapter: 5, verse: 3 }, to: { chapter: 5, verse: 3 } }] });
	assert.deepEqual(parseBibleReference("Prov_8:22-30").ranges, [{ from: { chapter: 8, verse: 22 }, to: { chapter: 8, verse: 30 } }]);
	assert.deepEqual(parseBibleReference("Lk_4:22b-30").ranges[0], { from: { chapter: 4, verse: 22, part: "b" }, to: { chapter: 4, verse: 30 } });
	assert.deepEqual(parseBibleReference("Gal_5:22-6:2").ranges[0], { from: { chapter: 5, verse: 22 }, to: { chapter: 6, verse: 2 } });
	assert.deepEqual(parseBibleReference("Composite_5").ranges, [{ from: { chapter: 5 }, to: { chapter: 5 } }]);
});

test("a chapter stays in force across comma-separated items", () => {
	assert.deepEqual(parseBibleReference("Lk_2:20-21, 40-52").ranges, [
		{ from: { chapter: 2, verse: 20 }, to: { chapter: 2, verse: 21 } },
		{ from: { chapter: 2, verse: 40 }, to: { chapter: 2, verse: 52 } },
	]);
	assert.deepEqual(parseBibleReference("Prov_10:31-32, 11:1-12").ranges[1], { from: { chapter: 11, verse: 1 }, to: { chapter: 11, verse: 12 } });
	// A range may start in the old chapter and end in the next.
	assert.deepEqual(parseBibleReference("Gal_1:1-10, 20-2:5").ranges[1], { from: { chapter: 1, verse: 20 }, to: { chapter: 2, verse: 5 } });
	assert.deepEqual(parseBibleReference("Mt_10:1,5-8").ranges.length, 2);
});

test("numbered books accept spaces or underscores", () => {
	assert.equal(parseBibleReference("I Cor_12:27-13:8a").book, "I_Cor");
	assert.equal(parseBibleReference("I_Cor_12:27").book, "I_Cor");
	assert.equal(parseBibleReference("III Kings_19:3-9, 11-13").book, "III_Kings");
	assert.equal(findBibleBook("II Pet")?.id, "II_Pet");
	assert.equal(findBibleBook("Nonsense"), undefined);
});

test("rejects malformed references", () => {
	for (const bad of ["Lk", "Lk_", "Nope_1:1", "Lk_2:", "Lk_2:20-", "Lk_x", "Lk_2:21-20", "Lk_999:1", "Lk_2:0", "Mt_5:3a-", "Lk_20-21", "Lk_2a", "_5:3"]) {
		assert.throws(() => parseBibleReference(bad), BibleReferenceError, bad);
	}
});

test("formatting reproduces the notation of the data", () => {
	for (const text of ["Lk_2:20-21, 40-52", "Gal_5:22-6:2", "Prov_10:31-32, 11:1-12", "Composite_5", "I Cor_12:27-13:8a", "Gal_1:1-10, 20-2:5", "Mt_5:3", "Lk_4:22b-30"]) {
		assert.equal(formatBibleReference(parseBibleReference(text)), text);
	}
	assert.equal(formatBibleReference(parseBibleReference("Tit_2:11-14,3:4-7")), "Tit_2:11-14, 3:4-7");
	assert.equal(formatBibleReference(parseBibleReference("Mt_10:1,5-8")), "Mt_10:1, 5-8");
});

test("every reference in the data parses, within the catalogue's chapters, and round-trips", () => {
	// Typos in the upstream data: lives/1777.xml (meant to end at 16:2) and lives/9803.xml (stray semicolon).
	const knownDataErrors = new Set(["Jn_15:17-6:2", "Mt_26:1-20; "]);
	const references = new Set<string>();
	for (const language of LANGUAGES) {
		for (const dir of ["lives", "float", "Services"]) {
			for (const file of listFiles(language, dir)) {
				const text = readFileSync(join(xmlDir(language), dir, file), "utf8");
				for (const match of text.matchAll(/\b(?:Reading|Verses)\s*=\s*"([^"]*)"/g)) {
					if (match[1] !== "") {
						references.add(match[1]!);
					}
				}
			}
		}
	}
	assert.ok(references.size > 1100, `expected the full corpus, found ${references.size}`);
	const problems: string[] = [];
	for (const text of references) {
		if (knownDataErrors.has(text)) {
			assert.throws(() => parseBibleReference(text), BibleReferenceError, text);
			continue;
		}
		try {
			const parsed = parseBibleReference(text);
			const reparsed = parseBibleReference(formatBibleReference(parsed));
			assert.deepEqual(reparsed, parsed);
		} catch (error) {
			problems.push(`${text}: ${(error as Error).message}`);
		}
	}
	assert.deepEqual(problems, []);
});
