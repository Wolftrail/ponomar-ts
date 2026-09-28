// Tests for Phase 5.5 canonical liturgy-reading ordering.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getOrderedLiturgyReadings } from "../src/engine/orderedLiturgy.ts";

describe("getOrderedLiturgyReadings — classification", () => {
	test("cId 9001 (Pascha) is classified as sequential", () => {
		const r = getOrderedLiturgyReadings({ year: 2020, month: 4, day: 19 });
		const pascha = r.apostol.find((x) => x.cId === "9001");
		assert.equal(pascha?.rank, "sequential");
	});

	test("cId 3174 (Nativity) is classified as festal", () => {
		const r = getOrderedLiturgyReadings({ year: 2024, month: 1, day: 7 });
		const nativity = r.apostol.find((x) => x.cId === "3174");
		assert.equal(nativity?.rank, "festal");
	});

	test("cIds with leading zeros (e.g. `09013`) are festal", () => {
		// A leading-zero cId falls outside the 4-digit [9000, 9899] window.
		const r = getOrderedLiturgyReadings({ year: 2020, month: 1, day: 18 });
		for (const ref of [...r.apostol, ...r.gospel]) {
			if (ref.cId.startsWith("0")) assert.equal(ref.rank, "festal");
		}
	});
});

describe("getOrderedLiturgyReadings — Suppress command", () => {
	test("Nativity (Julian Dec 25, Greg Jan 7 2024) suppresses sequential readings", () => {
		const r = getOrderedLiturgyReadings({ year: 2024, month: 1, day: 7 });
		for (const ref of r.apostol) assert.equal(ref.rank, "festal");
		for (const ref of r.gospel) assert.equal(ref.rank, "festal");
	});

	test("Nativity keeps at least one festal apostol + gospel", () => {
		const r = getOrderedLiturgyReadings({ year: 2024, month: 1, day: 7 });
		assert.ok(r.apostol.some((x) => x.reading === "Gal_4:4-7"));
		assert.ok(r.gospel.some((x) => x.reading === "Mt_2:1-12"));
	});

	test("Pascha 2020 keeps sequential readings (no Suppress match)", () => {
		const r = getOrderedLiturgyReadings({ year: 2020, month: 4, day: 19 });
		assert.ok(r.apostol.some((x) => x.cId === "9001"));
		assert.ok(r.gospel.some((x) => x.cId === "9001"));
	});
});

describe("getOrderedLiturgyReadings — Saturday inversion", () => {
	test("Saturday: festal appears before sequential (menaion first)", () => {
		// July 18 2020 Greg was Saturday, Julian July 5, non-fast, non-feast.
		const r = getOrderedLiturgyReadings({ year: 2020, month: 7, day: 18 });
		assert.equal(r.context.dow, 6);
		if (r.apostol.length >= 2) {
			const firstFestalIdx = r.apostol.findIndex((x) => x.rank === "festal");
			const firstSeqIdx = r.apostol.findIndex((x) => x.rank === "sequential");
			if (firstFestalIdx >= 0 && firstSeqIdx >= 0) {
				assert.ok(
					firstFestalIdx < firstSeqIdx,
					"festal must precede sequential on Saturday",
				);
			}
		}
	});

	test("Wednesday: sequential appears before festal", () => {
		// July 15 2020 Greg was Wednesday.
		const r = getOrderedLiturgyReadings({ year: 2020, month: 7, day: 15 });
		assert.equal(r.context.dow, 3);
		if (r.apostol.length >= 2) {
			const firstFestalIdx = r.apostol.findIndex((x) => x.rank === "festal");
			const firstSeqIdx = r.apostol.findIndex((x) => x.rank === "sequential");
			if (firstFestalIdx >= 0 && firstSeqIdx >= 0) {
				assert.ok(
					firstSeqIdx < firstFestalIdx,
					"sequential must precede festal on a weekday",
				);
			}
		}
	});
});

describe("getOrderedLiturgyReadings — shape", () => {
	test("refs is apostol + gospel concatenated in order", () => {
		const r = getOrderedLiturgyReadings({ year: 2020, month: 7, day: 15 });
		assert.deepEqual([...r.apostol, ...r.gospel], r.refs);
	});

	test("apostol entries all have type=apostol; gospel entries all have type=gospel", () => {
		const r = getOrderedLiturgyReadings({ year: 2020, month: 7, day: 15 });
		for (const x of r.apostol) assert.equal(x.type, "apostol");
		for (const x of r.gospel) assert.equal(x.type, "gospel");
	});

	test("every ref carries a rank field", () => {
		const r = getOrderedLiturgyReadings({ year: 2020, month: 7, day: 15 });
		for (const x of r.refs) assert.match(x.rank, /^(sequential|festal)$/);
	});
});
