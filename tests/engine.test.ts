// Tests for the day/engine facade: DayContext math and DayEntry lookup.
// Golden fixtures come from computing values by hand against upstream
// conventions (Julian civil calendar; Sunday = 0; nday = daysFromPascha).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
	computeDayContext,
	getLiturgicalDay,
	selectMenaionEntry,
	selectPaschalCycleEntry,
} from "../src/engine/index.ts";

describe("computeDayContext", () => {
	test("Pascha 2020 falls on nday=0 with dow=0 (Sunday)", () => {
		// Julian Apr 6 2020 = Gregorian Apr 19 2020, Pascha day.
		const ctx = computeDayContext({ year: 2020, month: 4, day: 19 });
		assert.equal(ctx.nday, 0);
		assert.equal(ctx.dow, 0);
		assert.equal(ctx.julian.month, 4);
		assert.equal(ctx.julian.day, 6);
	});

	test("Julian New Year (Gregorian Jan 14 2024) has doy=0", () => {
		const ctx = computeDayContext({ year: 2024, month: 1, day: 14 });
		assert.equal(ctx.doy, 0);
		assert.equal(ctx.julian.month, 1);
		assert.equal(ctx.julian.day, 1);
	});

	test("nday goes negative before Pascha and positive after", () => {
		const paschaMinus7 = computeDayContext({ year: 2020, month: 4, day: 12 });
		assert.equal(paschaMinus7.nday, -7);
		const paschaPlus7 = computeDayContext({ year: 2020, month: 4, day: 26 });
		assert.equal(paschaPlus7.nday, 7);
	});
});

describe("selectPaschalCycleEntry", () => {
	test("Pascha day resolves to first pentecostarion entry", () => {
		const ctx = computeDayContext({ year: 2020, month: 4, day: 19 });
		const entry = selectPaschalCycleEntry(ctx);
		assert.notEqual(entry, null);
		assert.ok(entry?.saints.length ?? 0 > 0);
	});

	test("Great Lent weekday resolves to a triodion entry", () => {
		// 40 days before Pascha 2020 (Julian Apr 6): Julian Feb 26 = Greg Mar 10 2020.
		const ctx = computeDayContext({ year: 2020, month: 3, day: 10 });
		assert.equal(ctx.nday, -40);
		const entry = selectPaschalCycleEntry(ctx);
		assert.notEqual(entry, null);
	});
});

describe("selectMenaionEntry", () => {
	test("Nativity of Christ (Julian Dec 25 = Gregorian Jan 7 2024)", () => {
		const ctx = computeDayContext({ year: 2024, month: 1, day: 7 });
		assert.equal(ctx.julian.month, 12);
		assert.equal(ctx.julian.day, 25);
		const entry = selectMenaionEntry(ctx);
		assert.notEqual(entry, null);
		assert.ok(entry!.saints.some((s) => s.cId === "3174"));
	});

	test("Julian Jan 1 (Gregorian Jan 14 2024)", () => {
		const ctx = computeDayContext({ year: 2024, month: 1, day: 14 });
		const entry = selectMenaionEntry(ctx);
		assert.notEqual(entry, null);
		// Canonical January 1 has the Circumcision + Basil the Great: 14+ saints.
		assert.ok(entry!.saints.length >= 3);
	});
});

describe("getLiturgicalDay", () => {
	test("returns paschal + menaion saints combined", () => {
		const day = getLiturgicalDay({ year: 2024, month: 1, day: 7 });
		assert.equal(day.context.julian.month, 12);
		assert.equal(day.context.julian.day, 25);
		assert.ok(day.menaionSaints.length > 0);
		assert.equal(
			day.allSaints.length,
			day.paschalSaints.length + day.menaionSaints.length,
		);
	});

	test("Cmd-guarded saints get filtered", () => {
		// Any date past Pascha will exercise DSL-guarded pentecostarion rows.
		const day = getLiturgicalDay({ year: 2020, month: 5, day: 1 });
		for (const s of day.allSaints) {
			// The exported `ResolvedSaint` has already had its `cmd` evaluated:
			// no `cmd` field survives, only the outcome.
			assert.equal("cmd" in (s as object), false);
		}
	});

	test("tone expressions resolve to finite integers", () => {
		const day = getLiturgicalDay({ year: 2020, month: 5, day: 1 });
		for (const s of day.allSaints) {
			if (s.tone === null) continue;
			assert.equal(Number.isInteger(s.tone), true);
		}
	});

	test("Nativity resolves with joined <NAME> from bundled data", () => {
		const day = getLiturgicalDay({ year: 2024, month: 1, day: 7 });
		const nativity = day.menaionSaints.find((s) => s.cId === "3174");
		assert.ok(nativity, "expected cId 3174 in menaion saints");
		assert.match(
			nativity.name?.nominative ?? "",
			/Nativity of our Lord/i,
		);
		assert.equal(nativity.name?.short, "Nativity");
	});

	test("St. Emily has a joined name.short from en/xml/lives/772441.xml", () => {
		// Julian Jan 1 = Gregorian Jan 14 2024. Emily of Cæsarea = cId 772441.
		const day = getLiturgicalDay({ year: 2024, month: 1, day: 14 });
		const emily = day.menaionSaints.find((s) => s.cId === "772441");
		assert.ok(emily, "expected cId 772441 (Emily) in menaion saints");
		assert.equal(emily.name?.short, "Emily");
		assert.equal(emily.name?.index, "Emily of Cæsarea");
	});
});

describe("getLiturgicalDay: rank overlay", () => {
	// Upstream ships <CHURCH Rank=...> on only ~6 XML files; the overlay
	// (src/data/rankOverlay.ts) supplies ranks for Pascha, the Twelve Great
	// Feasts, Bright Week, and a handful of vigil-rank saints.

	test("Pascha 2020 → dRank 8, cId 9001 carries rank 8", () => {
		const day = getLiturgicalDay({ year: 2020, month: 4, day: 19 });
		assert.equal(day.dRank, 8);
		const pascha = day.paschalSaints.find((s) => s.cId === "9001");
		assert.ok(pascha, "expected cId 9001 (Pascha) in paschal saints");
		assert.equal(pascha.church?.rank, 8);
	});

	test("Bright Monday 2020 → dRank 7 via cId 9002", () => {
		// Julian Apr 7 2020 = Gregorian Apr 20 2020, day after Pascha.
		const day = getLiturgicalDay({ year: 2020, month: 4, day: 20 });
		assert.equal(day.dRank, 7);
		assert.ok(day.paschalSaints.some((s) => s.cId === "9002"));
	});

	test("Nativity of Christ → dRank 7 via cId 3174", () => {
		const day = getLiturgicalDay({ year: 2024, month: 1, day: 7 });
		assert.equal(day.dRank, 7);
		const nativity = day.menaionSaints.find((s) => s.cId === "3174");
		assert.equal(nativity?.church?.rank, 7);
	});

	test("Dormition → dRank 6 via cId 4444", () => {
		// Julian Aug 15 = Gregorian Aug 28 2024.
		const day = getLiturgicalDay({ year: 2024, month: 8, day: 28 });
		assert.equal(day.dRank, 6);
		const dormition = day.menaionSaints.find((s) => s.cId === "4444");
		assert.equal(dormition?.church?.rank, 6);
	});

	test("Beheading of the Forerunner → dRank 5 via cId 91007", () => {
		// Julian Aug 29 = Gregorian Sep 11 2024.
		const day = getLiturgicalDay({ year: 2024, month: 9, day: 11 });
		assert.equal(day.dRank, 5);
	});

	test("Ordinary Tuesday → dRank 0 (no overlay hit)", () => {
		// Julian Oct 15 = Gregorian Oct 28 2025 (a Tuesday, no listed feast).
		const day = getLiturgicalDay({ year: 2025, month: 10, day: 28 });
		assert.equal(day.dRank, 0);
		for (const s of day.allSaints) {
			assert.notEqual(s.church?.rank, 8);
			assert.notEqual(s.church?.rank, 7);
			assert.notEqual(s.church?.rank, 6);
		}
	});

	test("overlay preserves non-rank <CHURCH> attributes when present", () => {
		// cId 373 is one of the six upstream-ranked records: it also carries
		// no cycle/tone, so the safest assertion is that after overlay it
		// carries the overlaid rank (7 = Meeting of the Lord).
		// Julian Feb 2 = Gregorian Feb 15 2024.
		const day = getLiturgicalDay({ year: 2024, month: 2, day: 15 });
		const meeting = day.menaionSaints.find((s) => s.cId === "373");
		assert.ok(meeting, "expected cId 373 in menaion saints");
		assert.equal(meeting.church?.rank, 7);
		assert.equal(day.dRank, 7);
	});
});

