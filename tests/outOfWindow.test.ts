// Phase D capstone: `getLiturgicalDay` composes HTOC-faithful propers +
// fast rubric for any civil year, not just the 2025-2030 vendored window.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getLiturgicalDay } from "../src/engine/index.ts";

describe("getLiturgicalDay — Phase D out-of-window composition", () => {
	test("2033 fixed Great Feast: Nativity (Julian Dec 25 = Gregorian Jan 7)", () => {
		const day = getLiturgicalDay({ year: 2033, month: 1, day: 7 });
		assert.ok(day.headerText.length > 0);
		assert.ok(
			day.troparia.some((h) => /Nativity/.test(h.title)),
			"expected Nativity troparion from the fixed-Julian cycle",
		);
		assert.ok(
			day.commemorations.some((c) => /Nativity/.test(c.text)),
			"expected Nativity commemoration from the fixed-Julian cycle",
		);
	});

	test("2033 Nativity Fast ordinary weekday: Julian Nov 15 (Gregorian Nov 28)", () => {
		const day = getLiturgicalDay({ year: 2033, month: 11, day: 28 });
		assert.equal(day.fasting.period.kind, "nativity");
		assert.equal(day.fasting.period.isEve, false);
	});

	test("2033 Great Lent: 20 days before Pascha", () => {
		// 2033 Orthodox Pascha is 2033-04-24 Gregorian (Julian Apr 11).
		// 20 days before = 2033-04-04.
		const day = getLiturgicalDay({ year: 2033, month: 4, day: 4 });
		assert.equal(day.fasting.period.kind, "great-lent");
	});

	test("2033 Sunday with octoechos tone emits Sunday resurrectional propers", () => {
		// Fourth Sunday after Pentecost of 2033 (algorithmic tone matches HTOC
		// on the whole vendored corpus, so this is reliable for 2033 too).
		// Pentecost 2033 = Jun 12; four weeks later = Jul 10 (Sunday).
		const day = getLiturgicalDay({ year: 2033, month: 7, day: 10 });
		assert.equal(day.context.dow, 0, "sanity: picked a Sunday");
		if (day.tone !== null) {
			assert.ok(
				day.troparia.length > 0,
				"expected at least the Sunday resurrectional troparion",
			);
		}
	});

	test("2033 ordinary weekday has algorithmic header + composed commemorations", () => {
		const day = getLiturgicalDay({ year: 2033, month: 5, day: 18 });
		assert.ok(day.headerText.length > 0);
		assert.ok(day.commemorations.length > 0);
		assert.ok(day.allSaints.length > 0);
		assert.ok(day.allSaints.every((s) => s.cId.startsWith("htoc:")));
	});

	test("2033-01-07 Nativity carries a numeric tone (matches HTOC convention)", () => {
		// HTOC does NOT suppress the tone on fixed Great Feasts of the Lord
		// (Nativity, Theophany, Transfiguration, Elevation of the Cross): in
		// the vendored 2025-2030 window every one of those feast dates has a
		// numeric 1..8 tone. The algorithmic `getOctoechosTone` matches that
		// convention, so Nativity 2033 should emit a numeric tone too.
		const day = getLiturgicalDay({ year: 2033, month: 1, day: 7 });
		assert.equal(day.context.dow, 5, "sanity: Jan 7, 2033 is a Friday");
		assert.equal(typeof day.tone, "number");
		assert.ok(day.troparia.length > 0);
	});

	test("2033 fasting period kinds are populated from the paschal + Julian cycle", () => {
		const greatLentWed = getLiturgicalDay({ year: 2033, month: 4, day: 6 });
		assert.equal(greatLentWed.fasting.period.kind, "great-lent");

		const apostlesFast = getLiturgicalDay({ year: 2033, month: 6, day: 20 });
		assert.equal(apostlesFast.fasting.period.kind, "apostles");

		const dormitionFastEve = getLiturgicalDay({ year: 2033, month: 8, day: 14 });
		assert.ok(
			dormitionFastEve.fasting.period.kind === "dormition",
			"expected Dormition Fast window",
		);
	});

	test("2033 ordinary non-fast weekday has no scheduled period", () => {
		// Jul 24 2033 is a Sun between the end of the Apostles' Fast (Jul 11)
		// and the start of the Dormition Fast (Aug 1). Pick a non-feast
		// weekday for a strict null-period check.
		const day = getLiturgicalDay({ year: 2033, month: 7, day: 25 });
		assert.equal(day.fasting.period.kind, null);
	});
});

