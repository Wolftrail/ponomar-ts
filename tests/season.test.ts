// Season classifier + Pentecost/Lenten week counters + Sviatki check +
// header renderer. Validated against the 1095-day vendored HTOC corpus.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DAY_FACTS_BY_ISO } from "../src/data/dayFacts.ts";
import { computeDayContext } from "../src/engine/day.ts";
import { renderHeaderText } from "../src/engine/headerText.ts";
import {
	getLentenWeek,
	getLiturgicalSeason,
	getPentecostWeek,
	isSviatki,
} from "../src/engine/season.ts";

function ctxFromIso(iso: string) {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	return computeDayContext({ year: y, month: m, day: d });
}

describe("getLiturgicalSeason — anchor days", () => {
	test("Pascha → 'pascha'", () => {
		assert.equal(getLiturgicalSeason(ctxFromIso("2025-04-20")), "pascha");
	});
	test("Thomas Sunday → 'antipascha'", () => {
		assert.equal(getLiturgicalSeason(ctxFromIso("2025-04-27")), "antipascha");
	});
	test("Pentecost → 'pentecost'", () => {
		assert.equal(getLiturgicalSeason(ctxFromIso("2025-06-08")), "pentecost");
	});
	test("Clean Monday → 'great-lent'", () => {
		assert.equal(getLiturgicalSeason(ctxFromIso("2025-03-03")), "great-lent");
	});
	test("Pub & Pharisee Sunday → 'publican-and-pharisee-sunday'", () => {
		assert.equal(
			getLiturgicalSeason(ctxFromIso("2025-02-09")),
			"publican-and-pharisee-sunday",
		);
	});
	test("All Saints Sunday → 'ordinary'", () => {
		assert.equal(getLiturgicalSeason(ctxFromIso("2025-06-15")), "ordinary");
	});
});

describe("getPentecostWeek", () => {
	test("All Saints Sunday (1st Sunday) returns 1", () => {
		assert.equal(getPentecostWeek(ctxFromIso("2025-06-15")), 1);
	});
	test("Monday after All Saints returns 2", () => {
		assert.equal(getPentecostWeek(ctxFromIso("2025-06-16")), 2);
	});
	test("New Year's Day 2025 returns 28", () => {
		assert.equal(getPentecostWeek(ctxFromIso("2025-01-01")), 28);
	});
	test("All Russian Saints 2025 returns 2", () => {
		assert.equal(getPentecostWeek(ctxFromIso("2025-06-22")), 2);
	});
});

describe("getLentenWeek", () => {
	test("Clean Monday returns 1", () => {
		assert.equal(getLentenWeek(ctxFromIso("2025-03-03")), 1);
	});
	test("First Sunday of Lent returns 1", () => {
		assert.equal(getLentenWeek(ctxFromIso("2025-03-09")), 1);
	});
	test("Second Monday of Lent returns 2", () => {
		assert.equal(getLentenWeek(ctxFromIso("2025-03-10")), 2);
	});
	test("Fifth Saturday of Lent returns 5", () => {
		assert.equal(getLentenWeek(ctxFromIso("2025-04-05")), 5);
	});
});

describe("isSviatki", () => {
	test("Julian Dec 25 (Gregorian Jan 7) is Sviatki", () => {
		assert.equal(isSviatki(ctxFromIso("2025-01-07")), true);
	});
	test("Julian Jan 4 (Gregorian Jan 17) is Sviatki", () => {
		assert.equal(isSviatki(ctxFromIso("2025-01-17")), true);
	});
	test("Julian Jan 5 (Gregorian Jan 18) is not Sviatki", () => {
		assert.equal(isSviatki(ctxFromIso("2025-01-18")), false);
	});
	test("Julian Dec 24 (Gregorian Jan 6) is not Sviatki", () => {
		assert.equal(isSviatki(ctxFromIso("2025-01-06")), false);
	});
});

describe("renderHeaderText matches all vendored HTOC facts", () => {
	for (const year of [2025, 2026, 2027] as const) {
		test(`${year} corpus matches HTOC headerText`, () => {
			let seen = 0;
			let mismatches = 0;
			for (const [iso, facts] of DAY_FACTS_BY_ISO) {
				if (!iso.startsWith(`${year}-`)) continue;
				seen++;
				const got = renderHeaderText(ctxFromIso(iso));
				if (got !== facts.headerText) {
					mismatches++;
					if (mismatches <= 3) {
						console.error(`  ${iso}:\n    exp=${JSON.stringify(facts.headerText)}\n    got=${JSON.stringify(got)}`);
					}
				}
			}
			assert.ok(seen > 360, `expected ~365 days for ${year}, saw ${seen}`);
			assert.equal(mismatches, 0, `${mismatches}/${seen} mismatches in ${year}`);
		});
	}

	test("full 2025-2027 corpus matches (1095 days)", () => {
		let seen = 0;
		let mismatches = 0;
		for (const [iso, facts] of DAY_FACTS_BY_ISO) {
			seen++;
			const got = renderHeaderText(ctxFromIso(iso));
			if (got !== facts.headerText) mismatches++;
		}
		assert.equal(seen, 1095);
		assert.equal(mismatches, 0, `${mismatches} mismatches across ${seen} vendored days`);
	});
});
