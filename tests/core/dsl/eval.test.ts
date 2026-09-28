import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	EvalError,
	evaluate,
	evaluateBool,
} from "../../../src/core/dsl/eval.ts";

describe("evaluate — arithmetic", () => {
	it("obeys standard precedence", () => {
		assert.equal(evaluate("1 + 2 * 3", {}), 7);
		assert.equal(evaluate("(1 + 2) * 3", {}), 9);
		assert.equal(evaluate("10 - 3 - 2", {}), 5);
	});

	it("uses IEEE-754 division (matches Java double)", () => {
		assert.equal(evaluate("10 / 4", {}), 2.5);
	});

	it("computes modulus", () => {
		assert.equal(evaluate("139 % 8", {}), 3);
	});

	it("handles unary minus chains", () => {
		assert.equal(evaluate("---5", {}), -5);
		assert.equal(evaluate("2 + -----5", {}), -3);
	});
});

describe("evaluate — logic", () => {
	it("returns 1/0 for comparisons", () => {
		assert.equal(evaluate("3 < 4", {}), 1);
		assert.equal(evaluate("3 == 4", {}), 0);
		assert.equal(evaluate("3 != 4", {}), 1);
	});

	it("&&, || return 1/0 and short-circuit on any nonzero value", () => {
		assert.equal(evaluate("1 && 0", {}), 0);
		assert.equal(evaluate("1 || 0", {}), 1);
		assert.equal(evaluate("2 && 3", {}), 1);
	});

	it("! coerces via nonzero == true", () => {
		assert.equal(evaluate("!0", {}), 1);
		assert.equal(evaluate("!1", {}), 0);
		assert.equal(evaluate("!!!!!0", {}), 1);
	});

	it("resolves true/false literals", () => {
		assert.equal(evaluate("true", {}), 1);
		assert.equal(evaluate("false", {}), 0);
		assert.equal(evaluate("!true", {}), 0);
	});
});

describe("evaluate — variables", () => {
	const ctx = { nday: 3, dow: 6, dRank: 8 };

	it("looks up numeric variables", () => {
		assert.equal(evaluate("nday", ctx), 3);
		assert.equal(evaluate("nday + dow", ctx), 9);
	});

	it("throws on unknown names", () => {
		assert.throws(() => evaluate("bogus", ctx), EvalError);
	});

	it("accepts boolean-valued context entries as 1/0", () => {
		assert.equal(evaluate("flag", { flag: true }), 1);
		assert.equal(evaluate("flag", { flag: false }), 0);
	});
});

describe("evaluateBool", () => {
	it("treats any nonzero result as true", () => {
		assert.equal(evaluateBool("1 + 2", {}), true);
		assert.equal(evaluateBool("0", {}), false);
		assert.equal(evaluateBool("nday > 4", { nday: 5 }), true);
	});
});
