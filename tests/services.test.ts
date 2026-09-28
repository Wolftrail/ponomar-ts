// Tests for Phase 7 Little-Hours service selection.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getServices } from "../src/engine/services.ts";

describe("getServices — period coverage", () => {
	test("Pascha 2020 (Bright Week, nday=0) selects Paschal for all four hours", () => {
		const r = getServices({ year: 2020, month: 4, day: 19 });
		assert.equal(r.context.nday, 0);
		assert.equal(r.prime?.type, "Paschal");
		assert.equal(r.terce?.type, "Paschal");
		assert.equal(r.sexte?.type, "Paschal");
		assert.equal(r.none?.type, "Paschal");
	});

	test("Bright Wednesday 2020 (nday=3) still Paschal", () => {
		const r = getServices({ year: 2020, month: 4, day: 22 });
		assert.equal(r.context.nday, 3);
		assert.equal(r.prime?.type, "Paschal");
	});

	test("Antipascha Sunday 2020 (nday=7) selects Easter with template", () => {
		const r = getServices({ year: 2020, month: 4, day: 26 });
		assert.equal(r.context.nday, 7);
		assert.equal(r.prime?.type, "Easter");
		assert.equal(r.prime?.troparion, "{P,T}");
		assert.equal(r.prime?.kontakion, "{P,T}");
		assert.equal(r.prime?.pickT, "1");
		assert.equal(r.prime?.pickK, "1");
	});

	test("Pentecost 2020 (nday=49) selects Normal with only tone", () => {
		const r = getServices({ year: 2020, month: 6, day: 7 });
		assert.equal(r.context.nday, 49);
		assert.equal(r.prime?.type, "Normal");
		assert.equal(r.prime?.troparion, "{T}");
	});
});

describe("getServices — Lenten periods", () => {
	test("Clean Monday 2020 selects Lenten with Monday kathisma numbers", () => {
		const r = getServices({ year: 2020, month: 3, day: 2 });
		assert.equal(r.context.nday, -48);
		assert.equal(r.context.dow, 1);
		assert.equal(r.prime?.type, "Lenten");
		assert.equal(r.prime?.kontakion, "MTTL");
		// TERCE/SEXTE/NONE get LENTENK 7/8/9 on Monday.
		assert.equal(r.terce?.lentenK, "7");
		assert.equal(r.sexte?.lentenK, "8");
		assert.equal(r.none?.lentenK, "9");
	});

	test("Great Friday 2020 (Holy Week, dow=5) selects Type='None' — no service", () => {
		const r = getServices({ year: 2020, month: 4, day: 17 });
		assert.equal(r.context.nday, -2);
		assert.equal(r.context.dow, 5);
		// Upstream: the Royal Hours replace the Little Hours on Great Fri;
		// the merge yields Type='None' plus the kontakion pattern still set
		// from the earlier Lenten rule (last-write-wins per attribute).
		assert.equal(r.prime?.type, "None");
		assert.equal(r.prime?.kontakion, "{P,T}");
	});

	test("Nativity Fast Wed 2020 (doy=323) selects Lenten PRIME with WFL kontakion", () => {
		const r = getServices({ year: 2020, month: 12, day: 2 });
		assert.equal(r.context.dow, 3);
		assert.equal(r.prime?.type, "Lenten");
		assert.equal(r.prime?.kontakion, "WFL");
	});
});

describe("getServices — Regular meat period", () => {
	test("Random summer Wed selects Normal with tone template", () => {
		const r = getServices({ year: 2020, month: 7, day: 15 });
		assert.equal(r.context.dow, 3);
		assert.equal(r.prime?.type, "Normal");
		assert.equal(r.prime?.troparion, "{T}");
	});
});

describe("getServices — shape", () => {
	test("every hour, if present, carries a non-empty type string", () => {
		const r = getServices({ year: 2020, month: 7, day: 15 });
		for (const h of [r.prime, r.terce, r.sexte, r.none]) {
			if (h !== undefined) {
				assert.equal(typeof h.type, "string");
				assert.ok(h.type.length > 0);
			}
		}
	});

	test("result carries the same DayContext as getLiturgicalDay", () => {
		const r = getServices({ year: 2024, month: 1, day: 7 });
		assert.equal(r.context.gregorian.year, 2024);
		assert.equal(r.context.gregorian.month, 1);
		assert.equal(r.context.gregorian.day, 7);
	});
});
