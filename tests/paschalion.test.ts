import assert from "node:assert/strict";
import test from "node:test";
import { getPascha } from "../src/paschalion.ts";

test("getPascha returns Julian Pascha dates", () => {
	assert.deepEqual(getPascha(2024), { year: 2024, month: 4, day: 22 });
	assert.deepEqual(getPascha(2025), { year: 2025, month: 4, day: 7 });
	assert.deepEqual(getPascha(2026), { year: 2026, month: 3, day: 30 });
	assert.deepEqual(getPascha(2027), { year: 2027, month: 4, day: 19 });
});

test("getPascha rejects unsupported years", () => {
	assert.throws(() => getPascha(32), RangeError);
	assert.throws(() => getPascha(2026.5), RangeError);
});