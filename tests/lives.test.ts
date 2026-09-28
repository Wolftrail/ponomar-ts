// Tests for the /lives subpath: the ~2 MB English LIFE prose payload.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { LIVES, getLife } from "../src/lives.ts";
import { COMMEMORATIONS } from "../src/data/index.ts";

describe("getLife", () => {
	test("returns undefined for unknown cId", () => {
		assert.equal(getLife("this-does-not-exist"), undefined);
	});

	test("Nativity (cId 3174) has the Bulgakov Handbook body", () => {
		const life = getLife("3174");
		assert.ok(life, "expected life for cId 3174");
		assert.equal(life.cId, "3174");
		assert.equal(life.id, "bulgakov");
		assert.match(life.body, /Nativity/);
		assert.ok(life.body.length > 500, "expected substantial prose");
	});

	test("Emily of Cæsarea (cId 772441) has Repose metadata even without a body", () => {
		const life = getLife("772441");
		assert.ok(life);
		assert.equal(life.repose, "4th Century");
	});
});

describe("COMMEMORATIONS metadata (joined into ResolvedSaint)", () => {
	test("Palamas Sunday (cId 543) carries rank 1 from the Commemorations tree", () => {
		const c = COMMEMORATIONS["543"];
		assert.ok(c);
		assert.equal(c.church?.rank, 1);
		assert.equal(c.info?.birthY, "1296");
		assert.equal(c.info?.deathY, "1359");
		assert.equal(c.info?.placeD, "Mt. Athos");
	});

	test("LIVES and COMMEMORATIONS keys overlap on populated cIds", () => {
		let overlap = 0;
		for (const cId of Object.keys(COMMEMORATIONS)) {
			if (LIVES[cId] !== undefined) overlap++;
		}
		// Expect at least the canonical Bulgakov entries.
		assert.ok(overlap > 400, `only ${overlap} overlapping cIds`);
	});
});
