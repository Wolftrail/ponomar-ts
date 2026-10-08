import assert from "node:assert/strict";
import test from "node:test";
import {
	getApostlesFastLength,
	getApostlesFastStart,
	getIndiction,
	getKeyOfBoundaries,
	getLentStart,
	getLunarCycle,
	getPascha,
	getPentecost,
	getSolarCycle,
	type JulianDate,
} from "../src/paschalion.ts";
import { loadGolden } from "./helpers/golden.ts";

const ymd = (d: JulianDate) => `${d.year}-${d.month}-${d.day}`;

test("matches upstream Paschalion for every year from 33 to 3000", () => {
	for (const row of loadGolden("pascha")) {
		const year = Number(row["year"]);
		assert.deepEqual(
			[
				ymd(getPascha(year)),
				ymd(getPentecost(year)),
				ymd(getLentStart(year)),
				ymd(getApostlesFastStart(year)),
				getApostlesFastLength(year),
				getKeyOfBoundaries(year),
				getIndiction(year),
				getSolarCycle(year),
				getLunarCycle(year),
			],
			[
				row["pascha"],
				row["pentecost"],
				row["lentStart"],
				row["apostlesFastStart"],
				Number(row["apostlesFastLength"]),
				Number(row["keyOfBoundaries"]),
				Number(row["indiction"]),
				Number(row["solarCycle"]),
				Number(row["lunarCycle"]),
			],
			`year ${year}`,
		);
	}
});

test("known Julian Pascha dates", () => {
	assert.equal(ymd(getPascha(2024)), "2024-4-22");
	assert.equal(ymd(getPascha(2025)), "2025-4-7");
	assert.equal(ymd(getPascha(2026)), "2026-3-30");
	assert.equal(ymd(getPascha(2027)), "2027-4-19");
});

test("rejects unsupported years", () => {
	for (const fn of [getPascha, getIndiction, getSolarCycle, getLunarCycle]) {
		assert.throws(() => fn(32), RangeError);
		assert.throws(() => fn(2026.5), RangeError);
	}
});