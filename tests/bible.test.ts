import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	BibleRefError,
	BIBLE_BOOKS,
	findBook,
	formatBibleRef,
	parseBibleRef,
} from "../src/bible/index.ts";

describe("BIBLE_BOOKS registry", () => {
	it("contains the en/kjv catalog with expected canonical ids", () => {
		const keys = Object.keys(BIBLE_BOOKS);
		assert.ok(keys.length >= 76, `got ${keys.length}`);
		for (const id of ["Gen", "Psalm", "I_Tim", "Apoc"]) {
			assert.ok(BIBLE_BOOKS[id], `missing ${id}`);
		}
	});

	it("resolves books by Id, Short (with spaces), Short-with-underscores, Name, and alias short", () => {
		assert.equal(findBook("I_Tim")?.id, "I_Tim");
		assert.equal(findBook("I Tim")?.id, "I_Tim");
		assert.equal(findBook("I Timothy")?.id, "I_Tim");
		assert.equal(findBook("Gen")?.id, "Gen");
		assert.equal(findBook("Genesis")?.id, "Gen");
		assert.equal(findBook("Ps")?.id, "Psalm");
		assert.equal(findBook("bogus"), undefined);
	});
});

describe("parseBibleRef — single-chapter forms", () => {
	it("parses simple contiguous range", () => {
		const r = parseBibleRef("II Tim_4:5-8");
		assert.equal(r.book, "II_Tim");
		assert.equal(r.chapter, 4);
		assert.equal(r.ranges.length, 1);
		assert.deepEqual(r.ranges[0]!.start, { chapter: 4, verse: 5 });
		assert.deepEqual(r.ranges[0]!.end, { chapter: 4, verse: 8 });
	});

	it("parses single-verse range", () => {
		const r = parseBibleRef("Gen_1:1");
		assert.equal(r.ranges.length, 1);
		assert.deepEqual(r.ranges[0]!.start, { chapter: 1, verse: 1 });
		assert.deepEqual(r.ranges[0]!.end, { chapter: 1, verse: 1 });
	});

	it("parses comma-separated multi-ranges with whitespace", () => {
		const r = parseBibleRef("Gen_17:1-7, 9-12, 14");
		assert.equal(r.chapter, 17);
		assert.equal(r.ranges.length, 3);
		assert.deepEqual(r.ranges[1]!.start, { chapter: 17, verse: 9 });
		assert.deepEqual(r.ranges[1]!.end, { chapter: 17, verse: 12 });
		assert.deepEqual(r.ranges[2]!.start, { chapter: 17, verse: 14 });
		assert.deepEqual(r.ranges[2]!.end, { chapter: 17, verse: 14 });
	});

	it("parses whole-chapter ref (no colon)", () => {
		const r = parseBibleRef("Psalm_5");
		assert.equal(r.book, "Psalm");
		assert.equal(r.chapter, 5);
		assert.deepEqual(r.ranges, []);
	});
});

describe("parseBibleRef — cross-chapter ranges", () => {
	it("parses V-C:V end form", () => {
		const r = parseBibleRef("I Tim_3:14-4:5");
		assert.equal(r.book, "I_Tim");
		assert.equal(r.chapter, 3);
		assert.equal(r.ranges.length, 1);
		assert.deepEqual(r.ranges[0]!.start, { chapter: 3, verse: 14 });
		assert.deepEqual(r.ranges[0]!.end, { chapter: 4, verse: 5 });
	});

	it("parses Heb_7:26-8:2", () => {
		const r = parseBibleRef("Heb_7:26-8:2");
		assert.deepEqual(r.ranges[0]!.start, { chapter: 7, verse: 26 });
		assert.deepEqual(r.ranges[0]!.end, { chapter: 8, verse: 2 });
	});
});

describe("parseBibleRef — half-verses (a/b/c)", () => {
	it("preserves part on start and end within one chapter", () => {
		const r = parseBibleRef("Num_24:2b-3a");
		assert.deepEqual(r.ranges[0]!.start, { chapter: 24, verse: 2, part: "b" });
		assert.deepEqual(r.ranges[0]!.end, { chapter: 24, verse: 3, part: "a" });
	});

	it("preserves part with cross-chapter range: Rom_13:11b-14:4", () => {
		const r = parseBibleRef("Rom_13:11b-14:4");
		assert.deepEqual(r.ranges[0]!.start, { chapter: 13, verse: 11, part: "b" });
		assert.deepEqual(r.ranges[0]!.end, { chapter: 14, verse: 4 });
	});

	it("Jn_5:30b-6:2", () => {
		const r = parseBibleRef("Jn_5:30b-6:2");
		assert.equal(r.book, "Jn");
		assert.deepEqual(r.ranges[0]!.start, { chapter: 5, verse: 30, part: "b" });
		assert.deepEqual(r.ranges[0]!.end, { chapter: 6, verse: 2 });
	});

	it("Num_24:2b-3a, 5-9, 17b-18 (three ranges with parts on the outer two)", () => {
		const r = parseBibleRef("Num_24:2b-3a, 5-9, 17b-18");
		assert.equal(r.ranges.length, 3);
		assert.equal(r.ranges[0]!.start.part, "b");
		assert.equal(r.ranges[0]!.end.part, "a");
		assert.equal(r.ranges[1]!.start.part, undefined);
		assert.equal(r.ranges[2]!.start.part, "b");
	});
});

describe("parseBibleRef — book resolution", () => {
	it("accepts Id form with underscore", () => {
		const r = parseBibleRef("I_Tim_4:5-8");
		assert.equal(r.book, "I_Tim");
		assert.equal(r.chapter, 4);
	});

	it("accepts Name form", () => {
		const r = parseBibleRef("Genesis_1:1");
		assert.equal(r.book, "Gen");
	});
});

describe("parseBibleRef — errors", () => {
	it("throws on unknown book", () => {
		assert.throws(() => parseBibleRef("Bogus_1:1"), BibleRefError);
	});

	it("throws on missing separator", () => {
		assert.throws(() => parseBibleRef("Gen1:1"), BibleRefError);
	});

	it("throws on empty input", () => {
		assert.throws(() => parseBibleRef(""), BibleRefError);
	});

	it("throws on out-of-range chapter", () => {
		assert.throws(() => parseBibleRef("Jude_5:1"), BibleRefError);
	});

	it("throws on non-numeric verse", () => {
		assert.throws(() => parseBibleRef("Gen_1:x"), BibleRefError);
	});
});

describe("formatBibleRef — round-trip", () => {
	const cases = [
		"II Tim_4:5-8",
		"Gen_17:1-7, 9-12, 14",
		"I Tim_3:14-4:5",
		"Heb_7:26-8:2",
		"Psalm_5",
		"Num_24:2b-3a",
		"Rom_13:11b-14:4",
		"Jn_5:30b-6:2",
	];
	for (const src of cases) {
		it(`round-trips ${src}`, () => {
			assert.equal(formatBibleRef(parseBibleRef(src)), src);
		});
	}
});
