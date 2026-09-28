import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { fromGregorian, julianDate } from "../../src/core/calendar/jdate.ts";
import {
	LUNAR_MONTH,
	getLunarCycle,
	getLunarPhase,
	getLunarPhaseName,
	getNextFullMoon,
	getNextNewMoon,
} from "../../src/astronomy/index.ts";

describe("getLunarCycle", () => {
	it("computes Metonic index for a range of years", () => {
		// (year+1) % 19 - 3, wrapped into [1, 19].
		assert.equal(getLunarCycle(2020), 4);
		assert.equal(getLunarCycle(2021), 5);
		assert.equal(getLunarCycle(2024), 8);
		assert.equal(getLunarCycle(2000), 3);
	});

	it("wraps within 1..19", () => {
		for (let y = 33; y < 33 + 40; y++) {
			const c = getLunarCycle(y);
			assert.ok(c >= 1 && c <= 19, `cycle ${c} for year ${y}`);
		}
	});

	it("rejects years before 33 AD", () => {
		assert.throws(() => getLunarCycle(32), RangeError);
		assert.throws(() => getLunarCycle(0), RangeError);
	});
});

describe("getLunarPhase", () => {
	it("returns a value in [0, 1)", () => {
		for (const g of [
			{ year: 2020, month: 1, day: 15 },
			{ year: 2020, month: 4, day: 8 },
			{ year: 2024, month: 3, day: 25 },
			{ year: 2100, month: 12, day: 31 },
		]) {
			const p = getLunarPhase(fromGregorian(g));
			assert.ok(p >= 0 && p < 1, `phase ${p} for ${JSON.stringify(g)}`);
		}
	});

	it("full moon on 2020-04-08 G is near 0.5 (Metonic estimate)", () => {
		const p = getLunarPhase(fromGregorian({ year: 2020, month: 4, day: 8 }));
		assert.ok(Math.abs(p - 0.5) < 0.1, `phase ${p} not near full`);
	});

	it("new moon on 2020-04-23 G is near 0 or 1 (Metonic estimate)", () => {
		const p = getLunarPhase(fromGregorian({ year: 2020, month: 4, day: 23 }));
		assert.ok(p > 0.9 || p < 0.1, `phase ${p} not near new`);
	});
});

describe("getLunarPhaseName", () => {
	it("buckets fractional phase into the eight cardinal names", () => {
		// Direct Julian dates chosen to hit each bucket per FOUNDATION[3] (cycle 4).
		const bucketFor = (raw: number): string => {
			// Reproduce the bucketing logic with an approximate phase; find a
			// date whose Metonic phase falls in each region.
			return raw < 0.017 || raw > 1 - 0.017
				? "new"
				: raw < 0.233 ? "waxing-crescent"
					: raw <= 0.267 ? "first-quarter"
						: raw < 0.483 ? "waxing-gibbous"
							: raw <= 0.517 ? "full"
								: raw < 0.733 ? "waning-gibbous"
									: raw <= 0.767 ? "last-quarter"
										: "waning-crescent";
		};
		for (const g of [
			{ year: 2020, month: 3, day: 26 },
			{ year: 2020, month: 4, day: 10 },
			{ year: 2020, month: 6, day: 15 },
			{ year: 2023, month: 7, day: 3 },
			{ year: 2024, month: 12, day: 1 },
		]) {
			const jd = fromGregorian(g);
			const raw = getLunarPhase(jd);
			assert.equal(getLunarPhaseName(jd), bucketFor(raw));
		}
	});
});

describe("getNextNewMoon / getNextFullMoon", () => {
	it("next new moon is within one lunar month after input", () => {
		const start = julianDate(2020, 3, 20);
		const next = getNextNewMoon(start);
		const diff = next.jdn - start.jdn;
		assert.ok(diff >= 0 && diff <= LUNAR_MONTH + 1, `diff ${diff}`);
	});

	it("next full moon is within one lunar month after input", () => {
		const start = julianDate(2020, 3, 20);
		const next = getNextFullMoon(start);
		const diff = next.jdn - start.jdn;
		assert.ok(diff >= 0 && diff <= LUNAR_MONTH + 1, `diff ${diff}`);
	});

	it("the day of the returned next-new-moon is near phase 0", () => {
		const next = getNextNewMoon(julianDate(2020, 3, 20));
		const p = getLunarPhase(next);
		assert.ok(p > 0.9 || p < 0.1, `phase ${p}`);
	});
});
