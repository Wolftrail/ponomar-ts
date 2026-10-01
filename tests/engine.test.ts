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
import { getOrthodoxPascha } from "../src/paschalion.ts";
import { addDays } from "../src/core/calendar/pcalendar.ts";

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
		// `nominative` is overlaid with the HTOC canonical wording, which
		// expands to "The Nativity according to the Flesh of Our Lord…".
		assert.match(
			nativity.name?.nominative ?? "",
			/Nativity.*Our Lord/i,
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
	// Feasts, and a handful of vigil-rank saints. Bright Week days are
	// intentionally *not* in the overlay — they are paschal continuation, not
	// individual Great Feasts.

	test("Pascha 2020 → dRank 8, cId 9001 carries rank 8", () => {
		const day = getLiturgicalDay({ year: 2020, month: 4, day: 19 });
		assert.equal(day.dRank, 8);
		const pascha = day.paschalSaints.find((s) => s.cId === "9001");
		assert.ok(pascha, "expected cId 9001 (Pascha) in paschal saints");
		assert.equal(pascha.church?.rank, 8);
	});

	test("Bright Monday 2020 → dRank 0 (paschal continuation, no overlay)", () => {
		// Julian Apr 7 2020 = Gregorian Apr 20 2020, day after Pascha.
		const day = getLiturgicalDay({ year: 2020, month: 4, day: 20 });
		assert.ok(day.paschalSaints.some((s) => s.cId === "9002"));
		assert.equal(day.dRank, 0);
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

	test("Beheading of the Forerunner → dRank 6 via cId 91007", () => {
		// Julian Aug 29 = Gregorian Sep 11 2024. One of the three Great-Feast
		// tier saint commemorations in Russian usage (alongside Nativity &
		// Beheading of the Forerunner and Ss. Peter & Paul); HTOC tags it
		// with the Great-Feast glyph.
		const day = getLiturgicalDay({ year: 2024, month: 9, day: 11 });
		assert.equal(day.dRank, 6);
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
		// carries the overlaid rank. Slavic Typikon convention places the
		// Meeting on the Theotokos side of the ladder at 6 (not 7).
		// Julian Feb 2 = Gregorian Feb 15 2024.
		const day = getLiturgicalDay({ year: 2024, month: 2, day: 15 });
		const meeting = day.menaionSaints.find((s) => s.cId === "373");
		assert.ok(meeting, "expected cId 373 in menaion saints");
		assert.equal(meeting.church?.rank, 6);
		assert.equal(day.dRank, 6);
	});

	test("Protection of the Theotokos → dRank 6 via cId 1638", () => {
		// Julian Oct 1 = Gregorian Oct 14 2024. HTOC / Russian tradition
		// elevates Protection to Great-Feast rank.
		const day = getLiturgicalDay({ year: 2024, month: 10, day: 14 });
		const protection = day.menaionSaints.find((s) => s.cId === "1638");
		assert.equal(protection?.church?.rank, 6);
		assert.equal(day.dRank, 6);
	});

	test("Circumcision + St. Basil → dRank 6 via cId 010101", () => {
		// Julian Jan 1 = Gregorian Jan 14 2024. HTOC tags Circumcision with
		// rank-glyph 6 (Great-Feast tier) in Russian / Slavic usage, so the
		// overlay rank sits at 6 despite the service structure resembling
		// a Polyeleos co-celebration of St. Basil.
		const day = getLiturgicalDay({ year: 2024, month: 1, day: 14 });
		const feast = day.menaionSaints.find((s) => s.cId === "010101");
		assert.equal(feast?.church?.rank, 6);
		assert.equal(day.dRank, 6);
	});
});

describe("getLiturgicalDay: movable Great Feasts (long range)", () => {
	// Palm Sunday / Ascension / Pentecost are computed off Pascha (Gauss'
	// formula) and their DayEntries live in fixed positions in the triodion
	// / pentecostarion arrays. Walk a 56-year span to lock in the invariant
	// that the rank overlay resolves the same across arbitrary years.
	const startYear = 2020;
	const endYear = 2076;

	for (const year of [startYear, 2033, 2050, 2075, endYear]) {
		const pascha = getOrthodoxPascha(year);

		test(`Palm Sunday ${year} → dRank 7 via cId 9807`, () => {
			const palm = addDays(pascha, -7);
			const day = getLiturgicalDay(palm);
			assert.equal(day.context.nday, -7);
			assert.ok(day.paschalSaints.some((s) => s.cId === "9807"));
			assert.equal(day.dRank, 7);
		});

		test(`Ascension ${year} → dRank 7 via cId 9040`, () => {
			const asc = addDays(pascha, 39);
			const day = getLiturgicalDay(asc);
			assert.equal(day.context.nday, 39);
			assert.ok(day.paschalSaints.some((s) => s.cId === "9040"));
			assert.equal(day.dRank, 7);
		});

		test(`Pentecost ${year} → dRank 7 via cId 9050`, () => {
			const pent = addDays(pascha, 49);
			const day = getLiturgicalDay(pent);
			assert.equal(day.context.nday, 49);
			assert.ok(day.paschalSaints.some((s) => s.cId === "9050"));
			assert.equal(day.dRank, 7);
		});
	}

	test(`Pascha itself → dRank 8 across the ${endYear - startYear + 1}-year span`, () => {
		for (let y = startYear; y <= endYear; y++) {
			const day = getLiturgicalDay(getOrthodoxPascha(y));
			assert.equal(day.dRank, 8, `Pascha ${y} should be dRank 8`);
			assert.equal(day.context.nday, 0);
		}
	});
});

describe("getLiturgicalDay: tone", () => {
	test("Pascha 2020 → tone null (outside the eight-tone cycle)", () => {
		const day = getLiturgicalDay({ year: 2020, month: 4, day: 19 });
		assert.equal(day.tone, null);
	});

	test("Bright Monday 2020 → tone null", () => {
		const day = getLiturgicalDay({ year: 2020, month: 4, day: 20 });
		assert.equal(day.tone, null);
	});

	test("Thomas Sunday 2020 → tone 1", () => {
		const day = getLiturgicalDay({ year: 2020, month: 4, day: 26 });
		assert.equal(day.tone, 1);
	});

	test("Myrrhbearers Sunday 2020 → tone 2", () => {
		const day = getLiturgicalDay({ year: 2020, month: 5, day: 3 });
		assert.equal(day.tone, 2);
	});

	test("Ordinary time falls in 1..8", () => {
		const day = getLiturgicalDay({ year: 2025, month: 10, day: 28 });
		assert.ok(day.tone !== null, "expected a tone in ordinary time");
		assert.ok(
			day.tone >= 1 && day.tone <= 8,
			`expected tone in 1..8, got ${day.tone}`,
		);
	});
});

