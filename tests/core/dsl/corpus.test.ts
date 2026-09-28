// Regression fixtures for the StringOp DSL, taken from actual `Value=`
// strings in vendor/ponomar/Ponomar/languages/xml/Commands/*.xml and
// evaluated by hand against sample contexts.
//
// Each fixture also gets a "compact" variant with all whitespace stripped
// out; upstream's text-splitting parser cannot handle that but our
// tokenising parser must.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Context } from "../../../src/core/dsl/eval.ts";
import { evaluate, evaluateBool } from "../../../src/core/dsl/eval.ts";

interface Case {
	readonly ctx: Context;
	readonly expected: boolean;
}

interface Fixture {
	readonly name: string;
	readonly expr: string;
	readonly cases: readonly Case[];
}

// Sourced from xml/Commands/DivineLiturgy.xml (entities decoded).
const FIXTURES: readonly Fixture[] = [
	{
		name: "Transfer",
		expr: "nday >= 52 || nday < -55",
		cases: [
			{ ctx: { nday: 60 }, expected: true },
			{ ctx: { nday: 0 }, expected: false },
			{ ctx: { nday: -60 }, expected: true },
			{ ctx: { nday: -55 }, expected: false },
			{ ctx: { nday: 52 }, expected: true },
		],
	},
	{
		name: "Suppress (Eve of Theophany)",
		expr: "doy == 4 && dow != 0 && dow != 6",
		cases: [
			{ ctx: { doy: 4, dow: 3 }, expected: true },
			{ ctx: { doy: 4, dow: 0 }, expected: false },
			{ ctx: { doy: 4, dow: 6 }, expected: false },
			{ ctx: { doy: 5, dow: 3 }, expected: false },
		],
	},
	{
		name: "Exaltation / Transfiguration",
		expr: "(doy == 256 || doy == 217) && dow != 0",
		cases: [
			{ ctx: { doy: 256, dow: 1 }, expected: true },
			{ ctx: { doy: 217, dow: 3 }, expected: true },
			{ ctx: { doy: 256, dow: 0 }, expected: false },
			{ ctx: { doy: 100, dow: 3 }, expected: false },
		],
	},
	{
		name: "Class 3 transfers",
		expr:
			"!(doy == 358 || doy == 357 || doy == 4 || doy == 5 || doy == 256 || doy == 217)" +
			" && ((dRank >= 5 && dow != 0) || dRank == 8)",
		cases: [
			{ ctx: { doy: 100, dRank: 8, dow: 0 }, expected: true },
			{ ctx: { doy: 100, dRank: 6, dow: 3 }, expected: true },
			{ ctx: { doy: 100, dRank: 6, dow: 0 }, expected: false },
			{ ctx: { doy: 4, dRank: 8, dow: 3 }, expected: false },
			{ ctx: { doy: 217, dRank: 8, dow: 3 }, expected: false },
		],
	},
	{
		name: "TransferRulesB",
		expr: "dow != 0 && !(nday >= -63 && nday <= 0) && doy != 338",
		cases: [
			{ ctx: { dow: 3, nday: 10, doy: 100 }, expected: true },
			{ ctx: { dow: 0, nday: 10, doy: 100 }, expected: false },
			{ ctx: { dow: 3, nday: -30, doy: 100 }, expected: false },
			{ ctx: { dow: 3, nday: 10, doy: 338 }, expected: false },
		],
	},
	{
		name: "Suppress (repeats around Christmas)",
		expr: "dRank >= 2 && nday == -96 && ndayP == 289 && (doy >= 3 && doy <= 4)",
		cases: [
			{
				ctx: { dRank: 3, nday: -96, ndayP: 289, doy: 4 },
				expected: true,
			},
			{
				ctx: { dRank: 3, nday: -95, ndayP: 289, doy: 4 },
				expected: false,
			},
			{
				ctx: { dRank: 1, nday: -96, ndayP: 289, doy: 4 },
				expected: false,
			},
		],
	},
	{
		name: "Sunday after Theophany suppression",
		expr: "(doy >= 6 && doy <= 12) && (dow == 0) && nday != -77 && nday != -70",
		cases: [
			{ ctx: { doy: 8, dow: 0, nday: 10 }, expected: true },
			{ ctx: { doy: 8, dow: 0, nday: -77 }, expected: false },
			{ ctx: { doy: 8, dow: 3, nday: 10 }, expected: false },
			{ ctx: { doy: 20, dow: 0, nday: 10 }, expected: false },
		],
	},
];

describe("StringOp corpus (DivineLiturgy.xml)", () => {
	for (const f of FIXTURES) {
		describe(f.name, () => {
			for (const c of f.cases) {
				const label = `${JSON.stringify(c.ctx)} → ${c.expected}`;
				it(label, () => {
					assert.equal(evaluateBool(f.expr, c.ctx), c.expected);
					// Numeric contract: bool result is 1/0.
					assert.equal(evaluate(f.expr, c.ctx), c.expected ? 1 : 0);
					// Same result with all whitespace stripped: verifies the
					// tokenising parser does not depend on spaces around ops
					// (which upstream's text-splitting parser does).
					const compact = f.expr.replace(/\s+/g, "");
					assert.equal(evaluateBool(compact, c.ctx), c.expected);
				});
			}
		});
	}
});
