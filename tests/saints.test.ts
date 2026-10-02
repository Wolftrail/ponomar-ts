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

// --- HTOC saints channel tests (formerly tests/htocSaints.test.ts) --
// Tests for the HTOC saints channel — additive parallel data alongside
// the Ponomar-derived paschal/menaion saints on `LiturgicalDay`.

import {
	SAINTS_BY_ISO,
	getLiturgicalDay,
} from "../src/index.ts";
import {
	getDayRank,
	getSaintsFor,
	mapRank,
} from "../src/engine/saints.ts";

describe("SAINTS_BY_ISO table", () => {
	test("covers 1092 unique ISO dates", () => {
		assert.equal(SAINTS_BY_ISO.size, 1092);
	});

	test("Jan 7 2025 (Nativity per Old Style) includes rank='6' entry", () => {
		const entries = SAINTS_BY_ISO.get("2025-01-07");
		assert.ok(entries !== undefined);
		const nativity = entries.find((e) => e.rank === "6");
		assert.ok(nativity, "expected a rank='6' Great Feast on 2025-01-07");
		assert.match(nativity.text, /Nativity/i);
	});
});

describe("mapRank", () => {
	test("rank '6' Great Feast promotes to Ponomar 7 (GFotL)", () => {
		assert.equal(mapRank("6"), 7);
	});
	test("rank '5' vigil maps to Ponomar 5", () => {
		assert.equal(mapRank("5"), 5);
	});
	test("rank '4' polyeleos maps to Ponomar 4", () => {
		assert.equal(mapRank("4"), 4);
	});
	test("rank '1' simple commemoration maps to Ponomar 1", () => {
		assert.equal(mapRank("1"), 1);
	});
	test("rank '0' no-service maps to 0", () => {
		assert.equal(mapRank("0"), 0);
	});
	test("rank 'o' octoechos/weekday maps to Ponomar 1 (simple tier)", () => {
		assert.equal(mapRank("o"), 1);
	});
});

describe("getSaintsFor + getDayRank", () => {
	test("Nativity 2025 (Jan 7) day rank = 7", () => {
		assert.equal(
			getDayRank({ year: 2025, month: 1, day: 7 }),
			7,
			"Nativity should map to Ponomar rank 7 (Great Feast of the Lord)",
		);
	});

	test("returns null outside 2025-2027 coverage window", () => {
		assert.equal(getSaintsFor({ year: 2030, month: 5, day: 15 }), null);
		assert.equal(getDayRank({ year: 2030, month: 5, day: 15 }), 0);
	});

	test("2025-04-14 has 7 saints (per recon)", () => {
		const saints = getSaintsFor({ year: 2025, month: 4, day: 14 });
		assert.ok(saints !== null);
		assert.equal(saints.length, 7);
	});
});

describe("LiturgicalDay htoc channel", () => {
	test("Nativity 2025 exposes saints + dRank", () => {
		const day = getLiturgicalDay({ year: 2025, month: 1, day: 7 });
		assert.ok(day.saints.length > 0);
		assert.equal(day.dRank, 7);
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
		assert.equal(day.dRank, 0);
		// Ponomar structural data should still be populated...
		assert.ok(day.menaionSaints.length > 0 || day.paschalSaints.length > 0);
		// ...and `saints` must remain non-empty (projected from the
		// structural lists) — the engine stays usable outside HTOC coverage.
		assert.ok(day.saints.length > 0);
		for (const s of day.saints) assert.match(s.slug, /^ponomar\//);
		// `allSaints` is now the HTOC-composed commemoration list (synthetic
		// cIds), independent of `saints`.
		assert.ok(day.allSaints.length > 0);
	});
});
