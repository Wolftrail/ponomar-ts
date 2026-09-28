// Tests for the Phase 6 fasting engine (port of Ponomar/Fasting.java).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getFasting } from "../src/engine/fasting.ts";

describe("getFasting — canonical cases", () => {
	test("Pascha 2020 (Sun Apr 19) → no-fast", () => {
		const r = getFasting({ year: 2020, month: 4, day: 19 });
		assert.equal(r.level, "no-fast");
		assert.equal(r.case, "1111111");
		assert.equal(r.permitted.meat, true);
		assert.equal(r.permitted.fish, true);
	});

	test("Bright Wednesday 2020 (Apr 22) → no-fast (Bright Week override)", () => {
		const r = getFasting({ year: 2020, month: 4, day: 22 });
		assert.equal(r.level, "no-fast");
	});

	test("Clean Monday 2020 (Mar 2) → no-food (first day of Great Lent)", () => {
		const r = getFasting({ year: 2020, month: 3, day: 2 });
		assert.equal(r.case, "0000000");
		assert.equal(r.level, "no-food");
		assert.equal(r.permitted.food, false);
	});

	test("Cheesefare Wednesday 2020 (Feb 26) → meat-excluded", () => {
		const r = getFasting({ year: 2020, month: 2, day: 26 });
		assert.equal(r.level, "meat-excluded");
		assert.equal(r.permitted.meat, false);
		assert.equal(r.permitted.dairy, true);
	});

	test("Great Friday 2020 (Apr 17) → no-food", () => {
		const r = getFasting({ year: 2020, month: 4, day: 17 });
		assert.equal(r.level, "no-food");
	});

	test("Apostles' Fast Wed (Jul 15 2020) → strict (xerophagy)", () => {
		const r = getFasting({ year: 2020, month: 7, day: 15 });
		assert.equal(r.case, "0000001");
		assert.equal(r.level, "strict");
		assert.equal(r.permitted.food, true);
		assert.equal(r.permitted.cookedFood, false);
	});

	test("Nativity Fast Fri (Dec 4 2020) → strict", () => {
		const r = getFasting({ year: 2020, month: 12, day: 4 });
		assert.equal(r.level, "strict");
	});

	test("Nativity Eve (Gregorian Jan 6 2024 = doy 357 Julian) → oil", () => {
		const r = getFasting({ year: 2024, month: 1, day: 6 });
		assert.equal(r.level, "oil");
	});

	test("Nativity itself (Gregorian Jan 7 2024) → no-fast (Christmastide)", () => {
		const r = getFasting({ year: 2024, month: 1, day: 7 });
		assert.equal(r.level, "no-fast");
	});
});

describe("getFasting — result shape", () => {
	test("all seven permission flags are booleans", () => {
		const r = getFasting({ year: 2020, month: 4, day: 19 });
		for (const key of [
			"meat",
			"dairy",
			"fish",
			"caviar",
			"oil",
			"cookedFood",
			"food",
		] as const) {
			assert.equal(typeof r.permitted[key], "boolean");
		}
	});

	test("case is always a 7-character bitstring", () => {
		for (const d of [
			{ year: 2020, month: 1, day: 1 },
			{ year: 2020, month: 4, day: 17 },
			{ year: 2020, month: 7, day: 15 },
			{ year: 2024, month: 8, day: 15 },
		]) {
			const r = getFasting(d);
			assert.match(r.case, /^[01]{7}$/);
		}
	});

	test("permitted flags mirror the bitstring bit-for-bit", () => {
		const r = getFasting({ year: 2020, month: 3, day: 2 });
		const b = r.case;
		assert.equal(r.permitted.meat, b[0] === "1");
		assert.equal(r.permitted.dairy, b[1] === "1");
		assert.equal(r.permitted.fish, b[2] === "1");
		assert.equal(r.permitted.caviar, b[3] === "1");
		assert.equal(r.permitted.oil, b[4] === "1");
		assert.equal(r.permitted.cookedFood, b[5] === "1");
		assert.equal(r.permitted.food, b[6] === "1");
	});
});
