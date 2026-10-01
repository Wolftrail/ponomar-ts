// Tests for the HTOC saints channel — additive parallel data alongside
// the Ponomar-derived paschal/menaion saints on `LiturgicalDay`.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
	HTOC_SAINTS_BY_ISO,
	getHtocDayRank,
	getHtocSaintsFor,
	getLiturgicalDay,
	mapHtocRank,
} from "../src/index.ts";

describe("HTOC_SAINTS_BY_ISO table", () => {
	test("covers 1092 unique ISO dates", () => {
		assert.equal(HTOC_SAINTS_BY_ISO.size, 1092);
	});

	test("Jan 7 2025 (Nativity per Old Style) includes rank='6' entry", () => {
		const entries = HTOC_SAINTS_BY_ISO.get("2025-01-07");
		assert.ok(entries !== undefined);
		const nativity = entries.find((e) => e.rank === "6");
		assert.ok(nativity, "expected a rank='6' Great Feast on 2025-01-07");
		assert.match(nativity.text, /Nativity/i);
	});
});

describe("mapHtocRank", () => {
	test("rank '6' Great Feast maps to Ponomar 7", () => {
		assert.equal(mapHtocRank("6"), 7);
	});
	test("rank '4' polyeleos maps to Ponomar 5 (vigil)", () => {
		assert.equal(mapHtocRank("4"), 5);
	});
	test("rank '1' six-stich maps to Ponomar 2", () => {
		assert.equal(mapHtocRank("1"), 2);
	});
	test("rank '0' no-service maps to 0", () => {
		assert.equal(mapHtocRank("0"), 0);
	});
	test("rank 'o' unranked maps to Ponomar 1", () => {
		assert.equal(mapHtocRank("o"), 1);
	});
});

describe("getHtocSaintsFor + getHtocDayRank", () => {
	test("Nativity 2025 (Jan 7) day rank = 7", () => {
		assert.equal(
			getHtocDayRank({ year: 2025, month: 1, day: 7 }),
			7,
			"Nativity should map to Ponomar rank 7 (Great Feast of the Lord)",
		);
	});

	test("returns null outside 2025-2027 coverage window", () => {
		assert.equal(getHtocSaintsFor({ year: 2030, month: 5, day: 15 }), null);
		assert.equal(getHtocDayRank({ year: 2030, month: 5, day: 15 }), 0);
	});

	test("2025-04-14 has 7 saints (per recon)", () => {
		const saints = getHtocSaintsFor({ year: 2025, month: 4, day: 14 });
		assert.ok(saints !== null);
		assert.equal(saints.length, 7);
	});
});

describe("LiturgicalDay htoc channel", () => {
	test("Nativity 2025 exposes saints + htocDRank", () => {
		const day = getLiturgicalDay({ year: 2025, month: 1, day: 7 });
		assert.ok(day.saints.length > 0);
		assert.equal(day.htocDRank, 7);
	});

	test("existing paschal/menaion channels are unchanged", () => {
		// This is a smoke test that the additive change didn't wipe out
		// Ponomar-derived data. Nativity has at least one Ponomar cId.
		const day = getLiturgicalDay({ year: 2025, month: 1, day: 7 });
		assert.ok(day.allSaints.length > 0);
		assert.ok(day.dRank > 0, "Ponomar dRank should still be set for Nativity");
	});

	test("out-of-window date falls back to Ponomar-projected saints", () => {
		const day = getLiturgicalDay({ year: 2030, month: 7, day: 15 });
		assert.equal(day.htocDRank, 0);
		// Ponomar structural data should still be populated...
		assert.ok(day.menaionSaints.length > 0 || day.paschalSaints.length > 0);
		// ...and `saints` should mirror it (projected from `allSaints`),
		// not be empty — the engine must remain usable outside HTOC coverage.
		assert.equal(day.saints.length, day.allSaints.length);
		for (const s of day.saints) assert.match(s.slug, /^ponomar\//);
	});
});
