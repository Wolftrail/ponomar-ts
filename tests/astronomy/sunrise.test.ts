import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	formatClock,
	getSunriseSunset,
	SunAltitude,
} from "../../src/astronomy/index.ts";

// Reference altitudes come from published civil times; port matches upstream
// Ponomar/Sunrise.java to sub-minute precision because both implementations
// share Paul Schlyter's SUNRISET.C algorithm.

describe("getSunriseSunset — civil dates", () => {
	it("Moscow summer solstice ≈ 03:41 / 21:20", () => {
		const r = getSunriseSunset(
			{ year: 2020, month: 6, day: 21 },
			{ longitude: 37.6173, latitude: 55.7558, tzOffsetHours: 3 },
		);
		assert.equal(formatClock(r.sunriseHours), "03:41");
		assert.equal(formatClock(r.sunsetHours), "21:20");
		assert.equal(r.sunAlwaysUp, false);
		assert.equal(r.sunAlwaysDown, false);
	});

	it("Moscow winter solstice ≈ 08:55 / 16:00", () => {
		const r = getSunriseSunset(
			{ year: 2020, month: 12, day: 21 },
			{ longitude: 37.6173, latitude: 55.7558, tzOffsetHours: 3 },
		);
		assert.equal(formatClock(r.sunriseHours), "08:55");
		assert.equal(formatClock(r.sunsetHours), "16:00");
	});

	it("New York equinox with DST offset applied", () => {
		const r = getSunriseSunset(
			{ year: 2024, month: 3, day: 20 },
			{ longitude: -73.9857, latitude: 40.7484, tzOffsetHours: -5, isDST: true },
		);
		assert.equal(formatClock(r.sunriseHours), "06:56");
		assert.equal(formatClock(r.sunsetHours), "19:09");
	});

	it("civil twilight altitude widens the window", () => {
		const normal = getSunriseSunset(
			{ year: 2024, month: 6, day: 1 },
			{ longitude: 0, latitude: 51.5, tzOffsetHours: 0 },
		);
		const civil = getSunriseSunset(
			{ year: 2024, month: 6, day: 1 },
			{ longitude: 0, latitude: 51.5, tzOffsetHours: 0, altitude: SunAltitude.CIVIL },
		);
		assert.ok(civil.sunriseHours < normal.sunriseHours);
		assert.ok(civil.sunsetHours > normal.sunsetHours);
	});
});

describe("getSunriseSunset — polar days", () => {
	it("80°N in June: sun always up", () => {
		const r = getSunriseSunset(
			{ year: 2024, month: 6, day: 21 },
			{ longitude: 0, latitude: 80, tzOffsetHours: 0 },
		);
		assert.equal(r.sunAlwaysUp, true);
		assert.equal(r.sunAlwaysDown, false);
	});

	it("80°N in December: sun always down", () => {
		const r = getSunriseSunset(
			{ year: 2024, month: 12, day: 21 },
			{ longitude: 0, latitude: 80, tzOffsetHours: 0 },
		);
		assert.equal(r.sunAlwaysUp, false);
		assert.equal(r.sunAlwaysDown, true);
	});
});

describe("formatClock", () => {
	it("zero-pads and truncates minutes", () => {
		assert.equal(formatClock(6.5), "06:30");
		assert.equal(formatClock(23.999), "23:59");
		assert.equal(formatClock(0.01), "00:00");
	});
});
