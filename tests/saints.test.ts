// Tests for the HTOC-centric saint API (Stage 1 of the HTOC-first facade).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
	cIdToSlug,
	getLifeBySlug,
	getSaint,
	getSaintByCId,
	slugToCId,
} from "../src/engine/saints.ts";
import {
	getReadings,
	getDay,
	getSaints,
} from "../src/engine/index.ts";
import {
	getHtocReadings,
	getHtocDayFacts,
	getHtocSaintsFor,
} from "../src/engine/index.ts";

describe("slug ↔ cId bridge", () => {
	test("December/19-01 (Boniface) resolves to cId 437", () => {
		assert.equal(slugToCId("December/19-01"), "437");
	});

	test("cId 437 round-trips back to December/19-01", () => {
		assert.equal(cIdToSlug("437"), "December/19-01");
	});

	test("Movable-cycle slugs return null (fixed-only coverage in Stage 1)", () => {
		assert.equal(slugToCId("Epiphany/p-52"), null);
		assert.equal(slugToCId("Epiphany/e12181-SundaybeforetheNativity"), null);
	});

	test("Malformed slugs return null", () => {
		assert.equal(slugToCId("not a slug"), null);
		assert.equal(slugToCId("December/19"), null);
		assert.equal(slugToCId("NotAMonth/19-01"), null);
	});

	test("Unknown cId returns null slug", () => {
		assert.equal(cIdToSlug("9999999"), null);
	});
});

describe("getLifeBySlug", () => {
	test("Boniface slug yields non-empty biography", () => {
		const life = getLifeBySlug("December/19-01");
		assert.ok(life !== null);
		assert.ok((life.body ?? "").length > 100);
	});

	test("Returns null for a slug without a Ponomar life", () => {
		assert.equal(getLifeBySlug("Epiphany/p-52"), null);
	});
});

describe("getSaint", () => {
	test("Boniface: 3 commemorations in 2025–2027 window, all January 1", () => {
		const profile = getSaint("December/19-01");
		assert.ok(profile !== null);
		assert.equal(profile.slug, "December/19-01");
		assert.equal(profile.cId, "437");
		assert.ok(profile.names.includes("Boniface"));
		assert.equal(profile.commemorations.length, 3);
		for (const c of profile.commemorations) {
			assert.equal(c.gregorian.month, 1);
			assert.equal(c.gregorian.day, 1);
			assert.equal(c.cycle, "fixed");
		}
		assert.ok(profile.life !== null);
	});

	test("Unknown slug returns null", () => {
		assert.equal(getSaint("Not/A-99"), null);
	});
});

describe("getSaintByCId", () => {
	test("Boniface via cId 437 matches the slug-driven lookup", () => {
		const bySlug = getSaint("December/19-01");
		const byCId = getSaintByCId("437");
		assert.ok(byCId !== null);
		assert.deepEqual(byCId, bySlug);
	});
});

describe("Unprefixed aliases match prefixed implementations", () => {
	const date = { year: 2026, month: 9, day: 27 } as const;

	test("getReadings === getHtocReadings", () => {
		assert.deepEqual(getReadings(date), getHtocReadings(date));
	});

	test("getDay === getHtocDayFacts", () => {
		assert.deepEqual(getDay(date), getHtocDayFacts(date));
	});

	test("getSaints === getHtocSaintsFor", () => {
		assert.deepEqual(getSaints(date), getHtocSaintsFor(date));
	});
});
