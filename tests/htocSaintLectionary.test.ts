// Tests for `src/engine/saintLectionary.ts` and the noted-HTOC-scripture
// appender inside `getDailyReadings`.

import { strict as assert } from "node:assert";
import { describe, test } from "node:test";

import {
	HTOC_SAINT_LECTIONARY,
	getHtocSaintLectionary,
} from "../src/engine/saintLectionary.ts";
import { getDailyReadings } from "../src/engine/readings.ts";
import {
	HTOC_SAINT_LECTIONARY_ROWS,
	HTOC_SAINT_LECTIONARY_SIZE,
} from "../src/data/htocSaintLectionary.ts";

describe("HTOC_SAINT_LECTIONARY table", () => {
	test("covers the vendored corpus window (2025-2027)", () => {
		assert.ok(
			HTOC_SAINT_LECTIONARY_SIZE > 700,
			`expected > 700 dates, got ${HTOC_SAINT_LECTIONARY_SIZE}`,
		);
		assert.ok(
			HTOC_SAINT_LECTIONARY_ROWS > 2000,
			`expected > 2000 rows, got ${HTOC_SAINT_LECTIONARY_ROWS}`,
		);
		assert.equal(HTOC_SAINT_LECTIONARY.size, HTOC_SAINT_LECTIONARY_SIZE);
	});

	test("classifies Matins Gospels as (matins, gospel)", () => {
		// 2025-01-02: HTOC lists a "Matins Gospel" note (Mt 6:1-13).
		const entries = getHtocSaintLectionary({ year: 2025, month: 1, day: 2 });
		assert.ok(entries !== null, "expected saint-lectionary entries for 2025-01-02");
		const mg = entries.find(
			(e) => e.service === "matins" && e.type === "gospel",
		);
		assert.ok(mg !== undefined, "expected a matins/gospel entry");
	});

	test("returns null outside the corpus window", () => {
		assert.equal(
			getHtocSaintLectionary({ year: 2100, month: 1, day: 1 }),
			null,
		);
	});
});

describe("getDailyReadings appends HTOC saint scriptures", () => {
	test("2025-05-13 (Apostle James Zebedee) emits all HTOC noted refs", () => {
		const refs = getDailyReadings({ year: 2025, month: 5, day: 13 }).refs;
		// Should include the noted Matins Gospel (John 21:15-25) and the
		// Ignatius Liturgy pair (Hebrews 7 + John 10).
		const readings = new Set(refs.map((r) => r.reading));
		assert.ok(
			readings.has("Jn_21:15-25"),
			"expected Matins Gospel Jn_21:15-25",
		);
		assert.ok(
			readings.has("Heb_7:26-8:2"),
			"expected St. Ignatius apostol Heb_7:26-8:2",
		);
		assert.ok(
			readings.has("Jn_10:9-16"),
			"expected St. Ignatius gospel Jn_10:9-16",
		);
	});

	test("saint-lectionary refs carry source='htoc' and note", () => {
		const refs = getDailyReadings({ year: 2025, month: 5, day: 13 }).refs;
		const withNote = refs.filter(
			(r) => r.cId === "htoc:saint-lectionary" && r.note !== undefined,
		);
		assert.ok(
			withNote.length > 0,
			"expected at least one saint-lectionary ref with note",
		);
		for (const r of withNote) assert.equal(r.source, "htoc");
	});

	test("service/type filter respects saint-lectionary buckets", () => {
		const matinsRefs = getDailyReadings(
			{ year: 2025, month: 5, day: 13 },
			{ service: "matins", type: "gospel" },
		).refs;
		assert.ok(matinsRefs.some((r) => r.reading === "Jn_21:15-25"));
		for (const r of matinsRefs) {
			assert.equal(r.service, "matins");
			assert.equal(r.type, "gospel");
		}
	});
});
