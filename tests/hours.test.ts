// Phase 8c-iii: Hour service wrappers.
//
// Each test date matches an existing services.test.ts date so we can trust
// the type classification and just verify the wrapper picks the right
// template and derives the right PFlag2.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getHourReadings, getHourService } from "../src/engine/index.ts";

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

// getHourReadings tests below verify HTOC-fixture-driven behaviour; dates
// picked from tests/fixtures/htoc-full-2025.json coverage. Note that many
// hour readings (Great Week Ezekiel, Royal Hours pericopes) are already
// carried by Ponomar upstream via `service: sexte|primes|terce|none`, so
// these tests assert bucketing rather than data provenance.
describe("getHourReadings — Lenten sixth-hour prophecies", () => {
	it("Clean Monday (Mar 3 2025) surfaces Isaiah 1:1-20 at the Sixth Hour", () => {
		const r = getHourReadings({ year: 2025, month: 3, day: 3 }, "sixth");
		assert.equal(r.hour, "sixth");
		const hit = r.refs.find((x) => x.reading === "Isa_1:1-20");
		assert.ok(
			hit !== undefined,
			`expected Isa 1:1-20 among Sixth-Hour refs; got [${r.refs
				.map((x) => x.reading)
				.join(", ")}]`,
		);
		assert.equal(hit.service, "sexte");
	});

	it("HTOC-tagged Sixth-Hour refs carry hour='sixth' when present", () => {
		const r = getHourReadings({ year: 2025, month: 3, day: 3 }, "sixth");
		const htoc = r.refs.find((x) => x.source === "htoc" && x.hour !== undefined);
		assert.ok(htoc !== undefined, "expected at least one HTOC hour-tagged ref");
		assert.equal(htoc.hour, "sixth");
	});

	it("Cheesefare Wed (Feb 26 2025) surfaces Joel 2:12-26 at the Sixth Hour", () => {
		const r = getHourReadings({ year: 2025, month: 2, day: 26 }, "sixth");
		const hit = r.refs.find((x) => x.reading === "Joel_2:12-26");
		assert.ok(hit !== undefined);
		assert.equal(hit.service, "sexte");
	});

	it("does not leak Sixth-Hour prophecies into other hours", () => {
		const cal = { year: 2025, month: 3, day: 3 } as const;
		for (const hour of ["prime", "third", "ninth"] as const) {
			const r = getHourReadings(cal, hour);
			assert.equal(
				r.refs.filter((x) => x.reading === "Isa_1:1-20").length,
				0,
				`Isa 1:1-20 leaked into ${hour}`,
			);
		}
	});
});

describe("getHourReadings — Royal Hours (Nativity Eve, Jan 6 2025)", () => {
	const CAL = { year: 2025, month: 1, day: 6 } as const;
	// Ponomar cId 09007 carries the full pericopes; HTOC repeats a shorter
	// Heb_1:1-2 form. Either satisfies the "reading assigned to this Hour"
	// check.
	const HOURS = [
		{ hour: "prime" as const, gospel: "Mt_1:18-25" },
		{ hour: "third" as const, gospel: "Lk_2:1-20" },
		{ hour: "sixth" as const, gospel: "Mt_2:1-12" },
		{ hour: "ninth" as const, gospel: "Mt_2:13-23" },
	] as const;
	for (const { hour, gospel } of HOURS) {
		it(`${hour} carries ${gospel}`, () => {
			const r = getHourReadings(CAL, hour);
			const hit = r.refs.find((x) => x.reading === gospel);
			assert.ok(
				hit !== undefined,
				`missing ${gospel} at ${hour}; got [${r.refs
					.map((x) => `${x.service}:${x.reading}`)
					.join(", ")}]`,
			);
		});
	}

	it("HTOC-tagged Royal Hours refs carry the matching hour tag", () => {
		for (const { hour } of HOURS) {
			const r = getHourReadings(CAL, hour);
			const htoc = r.refs.find(
				(x) => x.source === "htoc" && x.hour !== undefined,
			);
			assert.ok(
				htoc !== undefined,
				`expected an HTOC hour-tagged ref at ${hour}`,
			);
			assert.equal(htoc.hour, hour);
		}
	});
});

describe("getHourReadings — Royal Martyrs (Jul 17) regression", () => {
	// HTOC lists Rom 8:28-39 + Jn 15:17-16:2 with note "Royal Martyrs" on
	// July 17. The pre-fix classifier misrouted them to `service: "hour"`
	// via a naive `/royal/i` match; they belong on Liturgy.
	const CAL = { year: 2025, month: 7, day: 17 } as const;
	it("Rom 8:28-39 is a Liturgy apostol, not an hour reading", () => {
		for (const hour of ["prime", "third", "sixth", "ninth"] as const) {
			const r = getHourReadings(CAL, hour);
			assert.equal(
				r.refs.filter((x) => x.reading === "Rom_8:28-39").length,
				0,
				`Rom 8:28-39 leaked into ${hour}`,
			);
		}
	});

	it("Jn 15:17-16:2 is a Liturgy gospel, not an hour reading", () => {
		for (const hour of ["prime", "third", "sixth", "ninth"] as const) {
			const r = getHourReadings(CAL, hour);
			assert.equal(
				r.refs.filter((x) => x.reading === "Jn_15:17-16:2").length,
				0,
				`Jn 15:17-16:2 leaked into ${hour}`,
			);
		}
	});
});
