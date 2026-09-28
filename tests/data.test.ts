// Sanity checks on generated data. These help catch codegen regressions and
// verify the expected shape / cardinality of the upstream vendor files.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { DIVINE_LITURGY_COMMANDS } from "../src/data/divineLiturgy.ts";
import { MENAION } from "../src/data/menaion.ts";
import { PENTECOSTARION } from "../src/data/pentecostarion.ts";
import { TRIODION } from "../src/data/triodion.ts";

describe("generated data cardinality", () => {
	it("PENTECOSTARION has 315 entries", () => {
		assert.equal(PENTECOSTARION.length, 315);
	});
	it("TRIODION has 70 entries", () => {
		assert.equal(TRIODION.length, 70);
	});
	it("MENAION has at least one day from the sample vendor set", () => {
		assert.ok(Object.keys(MENAION).length > 0);
	});
	it("DIVINE_LITURGY_COMMANDS has at least ten entries", () => {
		assert.ok(DIVINE_LITURGY_COMMANDS.length >= 10);
	});
});

describe("generated data spot checks", () => {
	it("PENTECOSTARION[0] (Pascha) contains SAINT CId=9001", () => {
		const day = PENTECOSTARION[0];
		if (day === null || day === undefined) throw new Error("missing day 1");
		assert.ok(day.saints.some((s) => s.cId === "9001"));
	});

	it("MENAION['01-01'] contains the January 1 base entry", () => {
		const jan1 = MENAION["01-01"];
		if (jan1 === undefined) throw new Error("missing 01-01");
		assert.ok(jan1.saints.some((s) => s.cId === "010101"));
	});

	it("DIVINE_LITURGY_COMMANDS includes a Transfer rule", () => {
		assert.ok(DIVINE_LITURGY_COMMANDS.some((c) => c.name === "Transfer"));
	});
});
