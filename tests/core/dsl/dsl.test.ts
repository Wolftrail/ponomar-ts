import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DslError, evaluate, evaluateBoolean, parseExpression } from "../../../src/core/dsl/index.ts";

interface DslFixture {
	variables: string[];
	contexts: number[][];
	expressions: string[];
	results: string[];
}

const fixture = JSON.parse(
	readFileSync(new URL("../../fixtures/golden/dsl.json", import.meta.url), "utf8"),
) as DslFixture;

function run(expression: string, context: Record<string, number>): string {
	try {
		return String(evaluate(expression, context));
	} catch (error) {
		if (error instanceof DslError) {
			return "E";
		}
		throw error;
	}
}

test("agrees with upstream StringOp on every data expression", () => {
	const mismatches: string[] = [];
	fixture.expressions.forEach((expression, e) => {
		const expected = fixture.results[e]!.split(",");
		fixture.contexts.forEach((values, c) => {
			const context = Object.fromEntries(fixture.variables.map((name, i) => [name, values[i]!]));
			const actual = run(expression, context);
			const want = expected[c]!;
			const same = actual === "E" || want === "E" ? actual === want : Number(actual) === Number(want);
			if (!same) {
				mismatches.push(`${expression} [ctx ${c}] expected ${want}, got ${actual}`);
			}
		});
	});
	assert.equal(mismatches.length, 0, `${mismatches.length} mismatches, e.g.\n${mismatches.slice(0, 15).join("\n")}`);
});

test("precedence and associativity", () => {
	assert.equal(evaluate("1 + 2 * 3", {}), 7);
	assert.equal(evaluate("10 - 4 - 3", {}), 3);
	assert.equal(evaluate("20 / 5 / 2", {}), 2);
	assert.equal(evaluate("1 || 0 && 0", {}), 1);
	assert.equal(evaluate("!0 == 1", {}), 1);
	assert.equal(evaluate("-(2 + 3)", {}), -5);
	assert.equal(evaluate("2 - -3", {}), 5);
	assert.equal(evaluate("7 % 4 + 1", {}), 4);
});

test("variables, booleans and short-circuiting", () => {
	assert.equal(evaluateBoolean("nday < 4 && (dow == 5 || dow == 6)", { nday: 3, dow: 6 }), true);
	assert.equal(evaluateBoolean("true && !false", {}), true);
	assert.equal(evaluate("1 || missing", {}), 1);
	assert.equal(evaluate("0 && missing", {}), 0);
});

test("rejects malformed expressions", () => {
	assert.throws(() => evaluate("missing + 1", {}), DslError);
	assert.throws(() => parseExpression("(1 + 2"), DslError);
	assert.throws(() => parseExpression("1 +"), DslError);
	assert.throws(() => parseExpression("1 2"), DslError);
	assert.throws(() => parseExpression("LS == ##"), DslError);
});
