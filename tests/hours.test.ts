// Phase 8c-iii: Hour service wrappers.
//
// Each test date matches an existing services.test.ts date so we can trust
// the type classification and just verify the wrapper picks the right
// template and derives the right PFlag2.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getHourService } from "../src/engine/index.ts";

describe("getHourService — template selection", () => {
	it("Pascha 2020 (all four hours Paschal) composes PaschalHours.xml", () => {
		for (const hour of ["prime", "third", "sixth", "ninth"] as const) {
			const r = getHourService({ year: 2020, month: 4, day: 19 }, hour);
			assert.equal(r.selection?.type, "Paschal");
			assert.equal(r.templateName, "PaschalHours");
			assert.ok(r.service);
			assert.equal(r.service?.template, "PaschalHours");
			assert.equal(r.PFlag2, 0);
		}
	});

	it("Random summer Wed (Normal) picks the per-hour template with PFlag2=0", () => {
		const date = { year: 2020, month: 7, day: 15 };
		const cases: [Parameters<typeof getHourService>[1], string][] = [
			["prime", "Prime"],
			["third", "ThirdHour"],
			["sixth", "SixthHour"],
			["ninth", "NinthHour"],
		];
		for (const [hour, template] of cases) {
			const r = getHourService(date, hour);
			assert.equal(r.selection?.type, "Normal");
			assert.equal(r.templateName, template);
			assert.equal(r.PFlag2, 0);
			assert.equal(r.service?.template, template);
		}
	});

	it("Clean Monday 2020 (Lenten) auto-derives PFlag2=1", () => {
		const r = getHourService({ year: 2020, month: 3, day: 2 }, "prime");
		assert.equal(r.selection?.type, "Lenten");
		assert.equal(r.templateName, "Prime");
		assert.equal(r.PFlag2, 1);
	});

	it("Great Friday 2020 (Type='None') returns null template + null service", () => {
		const r = getHourService({ year: 2020, month: 4, day: 17 }, "prime");
		assert.equal(r.selection?.type, "None");
		assert.equal(r.templateName, null);
		assert.equal(r.service, null);
	});
});

describe("getHourService — flag overrides", () => {
	it("caller PFlag2 override takes precedence over auto-derivation", () => {
		const r = getHourService(
			{ year: 2020, month: 3, day: 2 },
			"prime",
			{ PFlag2: 3 },
		);
		assert.equal(r.selection?.type, "Lenten");
		assert.equal(r.PFlag2, 3);
	});

	it("PS=1 skips reader-only creates in the composed template", () => {
		const readerR = getHourService(
			{ year: 2020, month: 7, day: 15 },
			"ninth",
			{ PS: 0 },
		);
		const priestR = getHourService(
			{ year: 2020, month: 7, day: 15 },
			"ninth",
			{ PS: 1 },
		);
		assert.notEqual(
			readerR.service?.directives.length,
			priestR.service?.directives.length,
		);
	});

	it("PFlag1=1 skips UsualBeginning inclusion in NinthHour", () => {
		const withBeginning = getHourService(
			{ year: 2020, month: 7, day: 15 },
			"ninth",
			{ PFlag1: 0 },
		);
		const withoutBeginning = getHourService(
			{ year: 2020, month: 7, day: 15 },
			"ninth",
			{ PFlag1: 1 },
		);
		assert.ok(
			(withBeginning.service?.directives.length ?? 0) >
				(withoutBeginning.service?.directives.length ?? 0),
		);
	});
});

describe("getHourService — shape", () => {
	it("result carries the same DayContext as getServices", () => {
		const r = getHourService({ year: 2024, month: 1, day: 7 }, "ninth");
		assert.equal(r.context.gregorian.year, 2024);
		assert.equal(r.context.gregorian.month, 1);
		assert.equal(r.context.gregorian.day, 7);
		assert.equal(r.hour, "ninth");
	});

	it("selection maps ninth → services.none", () => {
		const r = getHourService({ year: 2020, month: 4, day: 26 }, "ninth");
		assert.equal(r.selection?.type, "Easter");
		assert.equal(r.templateName, "NinthHour");
	});
});
