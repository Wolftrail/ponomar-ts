import test from "node:test";
import { strict as assert } from "node:assert";

import { DAY_FACTS_BY_ISO } from "../src/engine/dayFacts.ts";
import {
	getDayFacts,
	isVendoredDate,
} from "../src/engine/dayFacts.ts";
import { getLiturgicalDay } from "../src/engine/index.ts";

test("getDayFacts returns vendored record verbatim within window", () => {
	for (const [iso, vendored] of DAY_FACTS_BY_ISO) {
		const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
		const got = getDayFacts({ year: y, month: m, day: d });
		assert.equal(got, vendored, `${iso}: must be the same object as vendored`);
	}
});

test("isVendoredDate marks the 2025–2030 window", () => {
	assert.equal(isVendoredDate({ year: 2024, month: 12, day: 31 }), false);
	assert.equal(isVendoredDate({ year: 2025, month: 1, day: 1 }), true);
	assert.equal(isVendoredDate({ year: 2026, month: 7, day: 15 }), true);
	assert.equal(isVendoredDate({ year: 2027, month: 12, day: 31 }), true);
	assert.equal(isVendoredDate({ year: 2028, month: 2, day: 29 }), true);
	assert.equal(isVendoredDate({ year: 2030, month: 12, day: 31 }), true);
	assert.equal(isVendoredDate({ year: 2031, month: 1, day: 1 }), false);
});

test("getDayFacts never returns null outside the vendored window", () => {
	const samples: Array<[number, number, number]> = [
		[2024, 1, 7],
		[2024, 4, 7],
		[2031, 3, 17],
		[2035, 9, 1],
		[2050, 12, 25],
	];
	for (const [y, m, d] of samples) {
		const facts = getDayFacts({ year: y, month: m, day: d });
		assert.ok(facts !== null);
		assert.equal(typeof facts.headerText, "string");
		assert.ok(facts.headerText.length > 0, `${y}-${m}-${d}: headerText must be non-empty`);
		assert.ok(Array.isArray(facts.commemorations));
		assert.deepEqual(facts.troparia, []);
		assert.deepEqual(facts.kontakia, []);
	}
});

test("algorithmic facts for 2028-01-07 match composed layers", () => {
	// 2028-01-07 Gregorian = Dec 25 Julian = Nativity of Christ.
	const facts = getDayFacts({ year: 2028, month: 1, day: 7 });
	assert.ok(facts.commemorations.length > 0);
	const nativity = facts.commemorations.find((c) =>
		c.text.includes("The Nativity according to the Flesh of Our Lord"),
	);
	assert.ok(nativity, "Nativity commemoration must be present on Jan 7 Gregorian / Dec 25 Julian");
	assert.equal(nativity.rank, "6");
	// Header carries the correct season marker for Sviatki + Fast-free week.
	assert.ok(facts.headerText.includes("Sviatki"));
	assert.ok(facts.headerText.includes("Fast-free"));
});

test("getLiturgicalDay populates commemorations + headerText for any year", () => {
	// 2030-04-28 Gregorian = Pascha 2030 (astronomically — well outside the
	// vendored window). Not asserting Pascha-specific text, just that the
	// engine composes a non-empty header for an arbitrary post-window date.
	const day = getLiturgicalDay({ year: 2030, month: 7, day: 15 });
	assert.ok(day.headerText.length > 0);
	assert.ok(Array.isArray(day.commemorations));
	// Tone must still fall out of the algorithmic layer.
	assert.ok(day.tone === null || (day.tone >= 1 && day.tone <= 8));
});

test("in-window getLiturgicalDay keeps HTOC-verbatim troparia / kontakia", () => {
	// Pick a Great Lent weekday for sanity.
	const day = getLiturgicalDay({ year: 2025, month: 3, day: 5 });
	const vendored = DAY_FACTS_BY_ISO.get("2025-03-05")!;
	assert.equal(day.troparia, vendored.troparia);
	assert.equal(day.kontakia, vendored.kontakia);
	assert.equal(day.headerText, vendored.headerText);
	assert.equal(day.tone, vendored.tone);
	assert.equal(day.fasting.period.kind, "great-lent");
});
