// Octoechos tone computer: validated against all vendored HTOC day
// facts, plus hand-checked anchor cases.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DAY_FACTS_BY_ISO } from "../src/engine/dayFacts.ts";
import { computeDayContext } from "../src/engine/day.ts";
import {
	getOctoechosTone,
	isToneSuppressed,
	rawOctoechosTone,
} from "../src/engine/tone.ts";

function ctxFromIso(iso: string) {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	return computeDayContext({ year: y, month: m, day: d });
}

describe("getOctoechosTone — anchor cases", () => {
	test("Pascha 2025 (Apr 20) → null", () => {
		assert.equal(getOctoechosTone(ctxFromIso("2025-04-20")), null);
	});

	test("Thomas Sunday 2025 (Apr 27, nday=7) → null", () => {
		assert.equal(getOctoechosTone(ctxFromIso("2025-04-27")), null);
	});

	test("Monday after Thomas 2025 (Apr 28, nday=8) → Tone 1", () => {
		assert.equal(getOctoechosTone(ctxFromIso("2025-04-28")), 1);
	});

	test("Pentecost 2025 (Jun 8, nday=49) → null", () => {
		assert.equal(getOctoechosTone(ctxFromIso("2025-06-08")), null);
	});

	test("Monday after Pentecost 2025 (Jun 9, nday=50) → Tone 7", () => {
		assert.equal(getOctoechosTone(ctxFromIso("2025-06-09")), 7);
	});

	test("All Saints Sunday 2025 (Jun 15, nday=56) → Tone 8", () => {
		assert.equal(getOctoechosTone(ctxFromIso("2025-06-15")), 8);
	});

	test("Great Lent weekday retains tone (Mar 3 2025, First Week) → Tone 3", () => {
		assert.equal(getOctoechosTone(ctxFromIso("2025-03-03")), 3);
	});

	test("Palm Sunday 2025 (Apr 13, nday=-7) → null", () => {
		assert.equal(getOctoechosTone(ctxFromIso("2025-04-13")), null);
	});

	test("Lazarus Saturday 2025 (Apr 12, nday=-8) retains Tone 8", () => {
		assert.equal(getOctoechosTone(ctxFromIso("2025-04-12")), 8);
	});
});

describe("isToneSuppressed", () => {
	test("suppressed on Palm Sunday through Thomas Sunday", () => {
		for (let n = -7; n <= 7; n++) {
			assert.equal(isToneSuppressed({ nday: n } as never), true, `nday=${n}`);
		}
	});

	test("suppressed on Pentecost", () => {
		assert.equal(isToneSuppressed({ nday: 49 } as never), true);
	});

	test("NOT suppressed on Great Lent weekdays", () => {
		for (const n of [-48, -40, -30, -20, -10, -8]) {
			assert.equal(isToneSuppressed({ nday: n } as never), false, `nday=${n}`);
		}
	});

	test("NOT suppressed on Pentecostarion Sundays between Thomas and Pentecost", () => {
		for (const n of [14, 21, 28, 35, 42]) {
			assert.equal(isToneSuppressed({ nday: n } as never), false, `nday=${n}`);
		}
	});
});

describe("rawOctoechosTone — 8-week cycle", () => {
	test("cycle restarts to Tone 1 the Monday after Thomas Sunday", () => {
		assert.equal(rawOctoechosTone(ctxFromIso("2025-04-28")), 1);
	});

	test("eight weeks later wraps back to Tone 1", () => {
		// 2025-04-28 + 56 days = 2025-06-23
		assert.equal(rawOctoechosTone(ctxFromIso("2025-06-23")), 1);
	});
});

describe("getOctoechosTone matches all vendored HTOC facts", () => {
	for (const year of [2025, 2026, 2027, 2028, 2029, 2030] as const) {
		test(`${year} corpus matches HTOC tone`, () => {
			let seen = 0;
			let mismatches = 0;
			for (const [iso, facts] of DAY_FACTS_BY_ISO) {
				if (!iso.startsWith(`${year}-`)) continue;
				seen++;
				const got = getOctoechosTone(ctxFromIso(iso));
				if (got !== facts.tone) {
					mismatches++;
					if (mismatches <= 5) {
						console.error(`  ${iso}: expected ${facts.tone}, got ${got}`);
					}
				}
			}
			assert.ok(seen > 360, `expected ~365 days for ${year}, saw ${seen}`);
			assert.equal(mismatches, 0, `${mismatches}/${seen} mismatches in ${year}`);
		});
	}

	test("full 2025-2030 corpus matches", () => {
		let mismatches = 0;
		let seen = 0;
		for (const [iso, facts] of DAY_FACTS_BY_ISO) {
			seen++;
			const got = getOctoechosTone(ctxFromIso(iso));
			if (got !== facts.tone) mismatches++;
		}
		assert.equal(seen, DAY_FACTS_BY_ISO.size);
		assert.equal(mismatches, 0, `${mismatches} mismatches across ${seen} vendored days`);
	});
});
