import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { LexError, tokenize } from "../../../src/core/dsl/lexer.ts";

describe("tokenize", () => {
	it("handles empty input", () => {
		const t = tokenize("");
		assert.equal(t.length, 1);
		assert.equal(t[0]?.kind, "EOF");
	});

	it("recognises numbers, idents, and paren", () => {
		const kinds = tokenize("nday == 42 && (dow != 0)").map((t) => t.kind);
		assert.deepEqual(kinds, [
			"IDENT",
			"EQ",
			"NUMBER",
			"AND",
			"LP",
			"IDENT",
			"NE",
			"NUMBER",
			"RP",
			"EOF",
		]);
	});

	it("ignores arbitrary whitespace", () => {
		const a = tokenize("nday==0").map((t) => t.kind);
		const b = tokenize("  nday  ==   0   ").map((t) => t.kind);
		assert.deepEqual(a, b);
	});

	it("supports decimal numbers", () => {
		const t = tokenize("3.14 + .5");
		assert.equal(t[0]?.text, "3.14");
		assert.equal(t[2]?.text, ".5");
	});

	it("distinguishes <= from < and >= from >", () => {
		const kinds = tokenize("a < b <= c > d >= e").map((t) => t.kind);
		assert.deepEqual(kinds, [
			"IDENT",
			"LT",
			"IDENT",
			"LE",
			"IDENT",
			"GT",
			"IDENT",
			"GE",
			"IDENT",
			"EOF",
		]);
	});

	it("throws LexError on unknown characters", () => {
		assert.throws(() => tokenize("nday @ 4"), LexError);
	});
});
