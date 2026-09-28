// Tests for Phase 8b ordered matins reading conflict resolution.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getOrderedMatinsReadings } from "../src/engine/orderedMatins.ts";

describe("getOrderedMatinsReadings — Sunday menaion yields to sequential", () => {
	// On these Sundays a menaion matins reading conflicts with the paschal-cycle
	// resurrection gospel; per Matins.Suppress() (dow==0 && dRank<=6) the
	// menaion reading yields.
	const cases = [
		{ date: { year: 2020, month: 1, day: 19 }, label: "Sun Jan 19 2020" },
		{ date: { year: 2020, month: 5, day: 24 }, label: "Sun May 24 2020" },
		{ date: { year: 2020, month: 6, day: 7 }, label: "Sun Jun 7 2020 (Pentecost)" },
		{ date: { year: 2020, month: 9, day: 27 }, label: "Sun Sep 27 2020" },
		{ date: { year: 2020, month: 10, day: 4 }, label: "Sun Oct 4 2020" },
	];
	for (const c of cases) {
		test(`${c.label}: menaion suppressed, paschal kept`, () => {
			const r = getOrderedMatinsReadings(c.date);
			assert.equal(r.context.dow, 0, "expected Sunday");
			assert.ok(
				r.refs.every((x) => x.source === "paschal" && x.rank === "sequential"),
				"kept refs should be paschal/sequential",
			);
			assert.ok(
				r.suppressed.every(
					(x) => x.source === "menaion" && x.rank === "festal",
				),
				"suppressed refs should be menaion/festal",
			);
			assert.ok(r.suppressed.length > 0, "expected menaion ref to be suppressed");
		});
	}
});

describe("getOrderedMatinsReadings — passthrough shape", () => {
	test("Non-Sunday menaion + paschal coexist without suppression", () => {
		// Sat Jan 18 2020: pre-Theophany. Paschal Sunday reading + menaion,
		// but dow != 0 so neither rule applies.
		const r = getOrderedMatinsReadings({ year: 2020, month: 1, day: 18 });
		assert.notEqual(r.context.dow, 0);
		assert.equal(r.suppressed.length, 0);
	});

	test("Nativity 2021 (Thu Jan 7): festal ref present, no suppression", () => {
		const r = getOrderedMatinsReadings({ year: 2021, month: 1, day: 7 });
		assert.equal(r.context.dow, 4);
		assert.equal(r.suppressed.length, 0);
		const nativity = r.refs.find(
			(x) => x.reading === "Mt_1:18-25" && x.source === "menaion",
		);
		assert.ok(nativity, "expected Nativity matins gospel");
		assert.equal(nativity.rank, "festal");
	});

	test("Sunday with no menaion matins reading: paschal kept, nothing suppressed", () => {
		// Sun Feb 2 2020: has paschal-cycle matins gospel; no menaion matins.
		const r = getOrderedMatinsReadings({ year: 2020, month: 2, day: 2 });
		assert.equal(r.context.dow, 0);
		assert.equal(r.suppressed.length, 0);
		assert.ok(r.refs.some((x) => x.source === "paschal"));
	});

	test("result carries the same DayContext as getLiturgicalDay", () => {
		const r = getOrderedMatinsReadings({ year: 2020, month: 6, day: 7 });
		assert.equal(r.context.gregorian.year, 2020);
		assert.equal(r.context.gregorian.month, 6);
		assert.equal(r.context.gregorian.day, 7);
	});
});
