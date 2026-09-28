import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ParseError, parse } from "../../../src/core/dsl/parser.ts";

describe("parse", () => {
	it("parses a literal number", () => {
		assert.deepEqual(parse("42"), { kind: "number", value: 42 });
	});

	it("parses an identifier", () => {
		assert.deepEqual(parse("nday"), { kind: "ident", name: "nday" });
	});

	it("gives * higher precedence than +", () => {
		// 1 + 2 * 3  ==>  1 + (2 * 3)
		const ast = parse("1 + 2 * 3");
		assert.equal(ast.kind, "binary");
		if (ast.kind !== "binary") throw new Error("unreachable");
		assert.equal(ast.op, "+");
		assert.equal(ast.right.kind, "binary");
	});

	it("is left-associative for equal precedence", () => {
		// 1 - 2 - 3  ==>  (1 - 2) - 3
		const ast = parse("1 - 2 - 3");
		if (ast.kind !== "binary") throw new Error("unreachable");
		assert.equal(ast.op, "-");
		assert.equal(ast.left.kind, "binary");
		assert.equal(ast.right.kind, "number");
	});

	it("parenthesises unary chains", () => {
		const ast = parse("!!nday");
		if (ast.kind !== "unary") throw new Error("unreachable");
		assert.equal(ast.op, "!");
		assert.equal(ast.operand.kind, "unary");
	});

	it("throws ParseError on unbalanced parentheses", () => {
		assert.throws(() => parse("(1 + 2"), ParseError);
	});

	it("throws ParseError on trailing garbage", () => {
		assert.throws(() => parse("1 2"), ParseError);
	});

	it("throws ParseError on empty input", () => {
		assert.throws(() => parse(""), ParseError);
	});
});
