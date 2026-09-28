// Tests for the Phase 5 readings API: getDailyReadings + getLiturgyReadings.
// These are golden fixtures — verified upstream Pascha readings are Acts 1:1-8
// (Apostol #1) + John 1:1-17 (Gospel #1); Nativity liturgy readings are
// Gal 4:4-7 (Apostol #209) + Mt 2:1-12 (Gospel #3).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
	getDailyReadings,
	getLiturgyReadings,
} from "../src/engine/readings.ts";

describe("getLiturgyReadings", () => {
	test("Pascha 2020 has Acts 1:1-8 + John 1:1-17", () => {
		const result = getLiturgyReadings({ year: 2020, month: 4, day: 19 });
		const apostol = result.refs.find(
			(r) => r.type === "apostol" && r.cId === "9001",
		);
		const gospel = result.refs.find(
			(r) => r.type === "gospel" && r.cId === "9001",
		);
		assert.equal(apostol?.reading, "Acts_1:1-8");
		assert.equal(apostol?.pericope, "1");
		assert.equal(gospel?.reading, "Jn_1:1-17");
		assert.equal(gospel?.pericope, "1");
	});

	test("Nativity of Christ (Gregorian Jan 7 2024) yields Gal 4:4-7 + Mt 2:1-12", () => {
		const result = getLiturgyReadings({ year: 2024, month: 1, day: 7 });
		const apostol = result.refs.find(
			(r) => r.type === "apostol" && r.cId === "3174",
		);
		const gospel = result.refs.find(
			(r) => r.type === "gospel" && r.cId === "3174",
		);
		assert.equal(apostol?.reading, "Gal_4:4-7");
		assert.equal(gospel?.reading, "Mt_2:1-12");
	});

	test("all returned refs are liturgy-service", () => {
		const result = getLiturgyReadings({ year: 2024, month: 1, day: 7 });
		for (const r of result.refs) assert.equal(r.service, "liturgy");
	});
});

describe("getDailyReadings", () => {
	test("with no filter returns liturgy + matins + vespers", () => {
		const result = getDailyReadings({ year: 2020, month: 4, day: 19 });
		const services = new Set(result.refs.map((r) => r.service));
		assert.ok(services.has("liturgy"));
		// Pascha lives file 9001 also has a vespers reading (John 20:19-25).
		assert.ok(services.has("vespers"));
	});

	test("type filter narrows to gospel only", () => {
		const result = getDailyReadings(
			{ year: 2020, month: 4, day: 19 },
			{ type: "gospel" },
		);
		for (const r of result.refs) assert.equal(r.type, "gospel");
		assert.ok(result.refs.length > 0);
	});

	test("source is tagged per originating cycle", () => {
		const result = getDailyReadings({ year: 2024, month: 1, day: 7 });
		const sources = new Set(result.refs.map((r) => r.source));
		// Nativity: menaion has cId 3174, paschal cycle also contributes.
		assert.ok(sources.has("menaion"));
	});
});
