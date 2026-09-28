import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	addDays,
	difference,
} from "../../../src/core/calendar/pcalendar.ts";

describe("pcalendar.addDays", () => {
	it("adds within a month", () => {
		assert.deepEqual(addDays({ year: 2026, month: 4, day: 19 }, 7), {
			year: 2026,
			month: 4,
			day: 26,
		});
	});
	it("crosses month boundaries", () => {
		assert.deepEqual(addDays({ year: 2026, month: 4, day: 28 }, 5), {
			year: 2026,
			month: 5,
			day: 3,
		});
	});
	it("crosses year boundaries", () => {
		assert.deepEqual(addDays({ year: 2026, month: 12, day: 30 }, 3), {
			year: 2027,
			month: 1,
			day: 2,
		});
	});
	it("supports negative offsets", () => {
		assert.deepEqual(addDays({ year: 2026, month: 1, day: 3 }, -5), {
			year: 2025,
			month: 12,
			day: 29,
		});
	});
	it("handles Gregorian leap years (2000 has Feb 29)", () => {
		assert.deepEqual(addDays({ year: 2000, month: 2, day: 28 }, 1), {
			year: 2000,
			month: 2,
			day: 29,
		});
	});
	it("handles Gregorian non-leap centuries (2100 has no Feb 29)", () => {
		assert.deepEqual(addDays({ year: 2100, month: 2, day: 28 }, 1), {
			year: 2100,
			month: 3,
			day: 1,
		});
	});
	it("rejects non-integer offsets", () => {
		assert.throws(
			() => addDays({ year: 2026, month: 4, day: 19 }, 1.5),
			RangeError,
		);
	});
});

describe("pcalendar.difference", () => {
	it("is signed (a - b)", () => {
		const a = { year: 2020, month: 4, day: 19 };
		const b = { year: 2020, month: 4, day: 12 };
		assert.equal(difference(a, b), 7);
		assert.equal(difference(b, a), -7);
	});
	it("crosses year boundaries", () => {
		const a = { year: 2021, month: 1, day: 2 };
		const b = { year: 2020, month: 12, day: 30 };
		assert.equal(difference(a, b), 3);
	});
});
