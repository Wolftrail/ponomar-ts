// Tests for the HTOC daily-lectionary override wired into `getDailyReadings`.
//
// Ponomar's vendored XML encodes the Moscow Patriarchate Slavonic recension
// of the Byzantine daily reading cycle and diverges from HTOC (ROCOR /
// Jordanville) on ~180 ordinary weekday gospels per year. The override
// fills the gap using the codegen'd `DAILY_LECTIONARY` table (keyed
// by `(ndayF, doy)`) for the 2025–2027 window.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
	getDailyReadings,
	getLiturgyReadings,
	DAILY_LECTIONARY,
	getLiturgicalDay,
} from "../src/index.ts";
import { getDailyLectionary } from "../src/engine/dailyLectionary.ts";

describe("DAILY_LECTIONARY table", () => {
	test("covers 880 slots", () => {
		assert.equal(DAILY_LECTIONARY.size, 880);
	});

	test("Jan 1 2025 (Wed, ndayF=-102, doy=351) → Mk_10:11-16", () => {
		const entries = DAILY_LECTIONARY.get("-102,351");
		assert.ok(entries !== undefined);
		assert.deepEqual(entries, [
			{ type: "apostol", reading: "Heb_10:1-18" },
			{ type: "gospel", reading: "Mk_10:11-16" },
		]);
	});
});

describe("getDailyLectionary", () => {
	test("Jan 1 2025 Wed → HTOC gospel = Mk 10:11-16", () => {
		const day = getLiturgicalDay({ year: 2025, month: 1, day: 1 });
		const entries = getDailyLectionary(day.context);
		assert.ok(entries !== null);
		const gospel = entries.find((e) => e.type === "gospel");
		assert.equal(gospel?.reading, "Mk_10:11-16");
	});

	test("returns null outside 2025-2027 window", () => {
		const day = getLiturgicalDay({ year: 2030, month: 7, day: 15 });
		const entries = getDailyLectionary(day.context);
		assert.equal(entries, null);
	});
});

describe("getDailyReadings wire-in", () => {
	test("Jan 1 2025 Liturgy emits HTOC-recension gospel Mk_10:11-16", () => {
		const readings = getLiturgyReadings({ year: 2025, month: 1, day: 1 });
		const gospels = readings.refs.filter(
			(r) => r.source === "htoc" && r.type === "gospel",
		);
		assert.ok(
			gospels.some((r) => r.reading === "Mk_10:11-16"),
			`expected HTOC gospel Mk_10:11-16 among ${JSON.stringify(gospels)}`,
		);
	});

	test("HTOC refs are tagged cId='htoc:daily-lectionary'", () => {
		const readings = getLiturgyReadings({ year: 2025, month: 1, day: 1 });
		const refs = readings.refs.filter((r) => r.source === "htoc");
		assert.ok(refs.length > 0);
		for (const r of refs) {
			assert.equal(r.cId, "htoc:daily-lectionary");
			assert.equal(r.service, "liturgy");
		}
	});

	test("dedup: no duplicate Apostol reading when Ponomar and HTOC agree", () => {
		// Pick a day where the two sides likely agree structurally (2025-06-15
		// Sunday, All Saints, well-anchored in both traditions).
		const readings = getLiturgyReadings({ year: 2025, month: 6, day: 15 });
		const apostols = readings.refs.filter((r) => r.type === "apostol");
		const seen = new Set<string>();
		for (const r of apostols) {
			const key = r.reading;
			assert.ok(!seen.has(key), `duplicate apostol reading: ${key}`);
			seen.add(key);
		}
	});

	test("service filter 'matins' suppresses HTOC daily-lectionary refs", () => {
		const readings = getDailyReadings(
			{ year: 2025, month: 1, day: 1 },
			{ service: "matins" },
		);
		assert.equal(
			readings.refs.filter((r) => r.source === "htoc").length,
			0,
			"HTOC override only fires for liturgy service",
		);
	});

	test("type filter 'apostol' returns only apostol HTOC refs", () => {
		const readings = getDailyReadings(
			{ year: 2025, month: 1, day: 1 },
			{ service: "liturgy", type: "apostol" },
		);
		const refs = readings.refs.filter((r) => r.source === "htoc");
		for (const r of refs) {
			assert.equal(r.type, "apostol");
		}
	});
});
