import test from "node:test";
import { strict as assert } from "node:assert";

import { HTOC_DAY_FACTS_BY_ISO } from "../src/data/htocDayFacts.ts";
import { computeDayContext } from "../src/engine/day.ts";
import {
	getCommemorationsForAnyYear,
	getDowMovables,
	getFixedCommemorations,
	getPaschalMovables,
	getSeasonCommemorations,
} from "../src/engine/commemorations.ts";
import { HTOC_FIXED_COMMEMORATIONS_CYCLE } from "../src/data/htocFixedCommemorations.ts";
import { HTOC_PASCHAL_MOVABLES_CYCLE } from "../src/data/htocPaschalMovables.ts";
import { HTOC_DOW_MOVABLES } from "../src/data/htocDowMovables.ts";

function ctxFor(iso: string) {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	return computeDayContext({ year: y, month: m, day: d });
}

test("fixed cycle: all 365 Julian keys present", () => {
	assert.equal(HTOC_FIXED_COMMEMORATIONS_CYCLE.size, 365);
});

test("fixed lookup: Julian Jan 1 (Gregorian Jan 14) — Basil the Great", () => {
	// 2025-01-14 is Julian Jan 1.
	const ctx = ctxFor("2025-01-14");
	assert.equal(ctx.julian.month, 1);
	assert.equal(ctx.julian.day, 1);
	const fixed = getFixedCommemorations(ctx);
	assert.ok(fixed.length > 0, "Jan 1 Julian must have fixed entries");
	assert.ok(
		fixed.some((c) => /Basil the Great/i.test(c.text)),
		"Jan 1 Julian must include Basil the Great",
	);
});

test("season markers: Clean Monday", () => {
	// 2025: Pascha = April 20 Gregorian → Clean Monday = March 3.
	const ctx = ctxFor("2025-03-03");
	const season = getSeasonCommemorations(ctx);
	assert.ok(
		season.some((c) => c.text === "Clean Monday."),
		"Clean Monday marker must be emitted",
	);
});

test("season markers: Dormition Fast begins Julian Aug 1", () => {
	// Gregorian Aug 14 is Julian Aug 1 in all three years.
	for (const iso of ["2025-08-14", "2026-08-14", "2027-08-14"]) {
		const season = getSeasonCommemorations(ctxFor(iso));
		assert.ok(
			season.some((c) => c.text === "Beginning of the Dormition Fast ."),
			`Dormition Fast marker must be emitted on ${iso}`,
		);
	}
});

test("season markers: Nativity Fast begins Julian Nov 15", () => {
	// Gregorian Nov 28 is Julian Nov 15 in all three years.
	for (const iso of ["2025-11-28", "2026-11-28", "2027-11-28"]) {
		const season = getSeasonCommemorations(ctxFor(iso));
		assert.ok(
			season.some((c) => c.text === "Beginning of Nativity Fast."),
			`Nativity Fast marker must be emitted on ${iso}`,
		);
	}
});

test("season markers: Apostles' Fast begins Monday after All Saints (nday=57)", () => {
	for (const iso of ["2025-06-16", "2026-06-08", "2027-06-28"]) {
		const ctx = ctxFor(iso);
		assert.equal(ctx.nday, 57, `${iso} must be nday=57`);
		const season = getSeasonCommemorations(ctx);
		assert.ok(
			season.some((c) => c.text === "Beginning of Apostles' (Peter & Paul) Fast"),
			`Apostles' Fast marker must be emitted on ${iso}`,
		);
	}
});

test("season markers: Sviatki marker only on Nativity (Julian Dec 25)", () => {
	// On Nativity itself.
	for (const iso of ["2025-01-07", "2026-01-07", "2027-01-07"]) {
		const season = getSeasonCommemorations(ctxFor(iso));
		assert.ok(
			season.some((c) => c.text.includes("Fast-free period (Sviatki)")),
			`Sviatki marker must be emitted on Nativity ${iso}`,
		);
	}
	// NOT on subsequent Sviatki days.
	for (const iso of ["2025-01-08", "2025-01-10", "2025-01-14", "2025-01-17"]) {
		const season = getSeasonCommemorations(ctxFor(iso));
		assert.ok(
			!season.some((c) => c.text.includes("Fast-free period (Sviatki)")),
			`Sviatki marker must NOT be emitted on ${iso}`,
		);
	}
});

test("paschal cycle: nday=14 (3rd Sun of Pascha) includes Myrrh-Bearing Women", () => {
	const entries = HTOC_PASCHAL_MOVABLES_CYCLE.get(14) ?? [];
	assert.ok(entries.some((c) => /Myrrh-Bearing Women/i.test(c.text)));
});

test("paschal cycle: nday=39 (Ascension) includes Georgian Martyrs anchored to Ascension", () => {
	const entries = HTOC_PASCHAL_MOVABLES_CYCLE.get(39) ?? [];
	assert.ok(
		entries.some((c) => /Holy Georgian Martyrs of Persia/i.test(c.text)),
		"nday=39 should include the Georgian Martyrs commemoration anchored to Ascension",
	);
});

test("paschal cycle: nday=49 (Trinity Sunday) includes Lesna Icon anchored to Trinity Sunday", () => {
	const entries = HTOC_PASCHAL_MOVABLES_CYCLE.get(49) ?? [];
	assert.ok(
		entries.some((c) => /Lesna.*Theotokos.*Trinity Sunday/i.test(c.text)),
		"nday=49 should include the 'Lesna' Icon of the Theotokos commemoration",
	);
});

test("paschal cycle: nday=-48 (Clean Monday) is EMPTY (season-synth handles it)", () => {
	const entries = HTOC_PASCHAL_MOVABLES_CYCLE.get(-48) ?? [];
	for (const e of entries) {
		assert.ok(e.text !== "Clean Monday.", "Clean Monday must be season-synth, not paschal-movable");
	}
});

test("getPaschalMovables: Myrrh-Bearers emitted for any year at nday=14", () => {
	// 2030 Pascha = April 28 → 3rd Sunday of Pascha = May 12.
	const ctx = computeDayContext({ year: 2030, month: 5, day: 12 });
	assert.equal(ctx.nday, 14, "May 12 2030 must be nday=14");
	const movables = getPaschalMovables(ctx);
	assert.ok(movables.some((c) => /Myrrh-Bearing Women/i.test(c.text)));
});

test("coverage: ≥90% perfect-match days vs 1095 vendored", () => {
	let perfect = 0;
	const keyOf = (c: { rank: string; text: string; minor: boolean }) =>
		`${c.rank}|${c.minor ? 1 : 0}|${c.text}`;
	for (const [iso, facts] of HTOC_DAY_FACTS_BY_ISO) {
		const got = getCommemorationsForAnyYear(ctxFor(iso));
		const exp = new Set(facts.commemorations.map(keyOf));
		const gotSet = new Set(got.map(keyOf));
		if (exp.size !== gotSet.size) continue;
		let match = true;
		for (const k of exp) if (!gotSet.has(k)) { match = false; break; }
		if (match) perfect++;
	}
	assert.ok(
		perfect >= Math.floor(1095 * 0.99),
		`Expected ≥99% perfect-match days, got ${perfect}/1095 (${((perfect / 1095) * 100).toFixed(1)}%)`,
	);
});

test("coverage: ≥99.9% commemoration-entry recall vs 1095 vendored", () => {
	let expected = 0;
	let correct = 0;
	const keyOf = (c: { rank: string; text: string; minor: boolean }) =>
		`${c.rank}|${c.minor ? 1 : 0}|${c.text}`;
	for (const [iso, facts] of HTOC_DAY_FACTS_BY_ISO) {
		const got = new Set(getCommemorationsForAnyYear(ctxFor(iso)).map(keyOf));
		for (const c of facts.commemorations) {
			expected++;
			if (got.has(keyOf(c))) correct++;
		}
	}
	const pct = (correct / expected) * 100;
	assert.ok(
		pct >= 99.9,
		`Expected ≥99.9% recall, got ${correct}/${expected} (${pct.toFixed(2)}%)`,
	);
});

test("coverage: ≤3 extra entries across 1095 vendored days", () => {
	let extras = 0;
	const keyOf = (c: { rank: string; text: string; minor: boolean }) =>
		`${c.rank}|${c.minor ? 1 : 0}|${c.text}`;
	for (const [iso, facts] of HTOC_DAY_FACTS_BY_ISO) {
		const exp = new Set(facts.commemorations.map(keyOf));
		for (const c of getCommemorationsForAnyYear(ctxFor(iso))) {
			if (!exp.has(keyOf(c))) extras++;
		}
	}
	assert.ok(extras <= 3, `Expected ≤3 extras, got ${extras}`);
});

// --- Phase C4: DOW-shift / DOW-nearest-Julian movable commemorations ---

test("dow-shift inventory: at least 40 rule-tagged entries emitted", () => {
	assert.ok(
		HTOC_DOW_MOVABLES.length >= 40,
		`Expected ≥40 DOW-shift entries, got ${HTOC_DOW_MOVABLES.length}`,
	);
});

test("dow-shift: Sunday after Nativity, holy ancestors fires Dec 26-Jan 1 Julian Sun", () => {
	// 2026-01-11 is Julian Dec 29 2025, Sunday.
	const ctx = computeDayContext({ year: 2026, month: 1, day: 11 });
	assert.equal(ctx.julian.month, 12);
	assert.equal(ctx.julian.day, 29);
	assert.equal(ctx.dow, 0);
	const dow = getDowMovables(ctx);
	assert.ok(
		dow.some((c) => c.text.startsWith("Sunday after the Nativity of our Lord God and Savior Jesus Christ, holy ancestors.")),
		"Sunday after Nativity marker should fire on Dec 29 Julian Sunday",
	);
});

test("dow-shift: Saturday the Nativity fires Dec 20-24 Julian Sat", () => {
	// 2026-01-03 is Julian Dec 21 2025, Saturday.
	const ctx = computeDayContext({ year: 2026, month: 1, day: 3 });
	assert.equal(ctx.julian.month, 12);
	assert.equal(ctx.julian.day, 21);
	assert.equal(ctx.dow, 6);
	const dow = getDowMovables(ctx);
	assert.ok(
		dow.some((c) => c.text.startsWith("Saturday the Nativity of our Lord God and Savior Jesus Christ")),
		"'Saturday the Nativity' marker should fire on Sat Dec 21 Julian",
	);
});

test("dow-shift: Parents' Saturday fires only on nday -36 / -29 / -22", () => {
	for (const nday of [-36, -29, -22]) {
		// Find any date with this nday in the vendored window.
		let found = false;
		for (const [iso] of HTOC_DAY_FACTS_BY_ISO) {
			const ctx = ctxFor(iso);
			if (ctx.nday === nday) {
				const dow = getDowMovables(ctx);
				assert.ok(
					dow.some((c) => c.text.startsWith("Parents\u2019 Saturday. Remembrance of the dead")),
					`Parents' Saturday should fire on nday=${nday}`,
				);
				found = true;
				break;
			}
		}
		assert.ok(found, `vendored window should contain a day with nday=${nday}`);
	}
});

test("dow-shift: Parents' Saturday does NOT fire on Meatfare Saturday (nday=-57)", () => {
	// 2025 Pascha = April 20 Greg → Meatfare Sat = April 20 - 57 days = Feb 22.
	const ctx = computeDayContext({ year: 2025, month: 2, day: 22 });
	assert.equal(ctx.nday, -57);
	const dow = getDowMovables(ctx);
	assert.ok(
		!dow.some((c) => c.text.startsWith("Parents\u2019 Saturday")),
		"Parents' Saturday must not fire on Meatfare Saturday (nday=-57)",
	);
});

test("dow-shift: Commemoration of Seventh Ecumenical Council fires Sun in Julian Oct 11-17", () => {
	// 2025-10-26 Greg = Julian Oct 13 2025, Sunday.
	const ctx = computeDayContext({ year: 2025, month: 10, day: 26 });
	assert.equal(ctx.julian.month, 10);
	assert.equal(ctx.julian.day, 13);
	assert.equal(ctx.dow, 0);
	const dow = getDowMovables(ctx);
	assert.ok(
		dow.some((c) => c.text.startsWith("Commemoration of the Holy Fathers of the Seventh Ecumenical Council")),
		"Seventh Council commemoration should fire on Sun Julian Oct 13",
	);
});

test("dow-shift: New Martyrs of Russian Church fires on Sunday closest to Julian Jan 25", () => {
	// 2025-02-09 Greg = Julian Jan 27, Sunday.
	const ctx = computeDayContext({ year: 2025, month: 2, day: 9 });
	assert.equal(ctx.julian.month, 1);
	assert.equal(ctx.julian.day, 27);
	assert.equal(ctx.dow, 0);
	const dow = getDowMovables(ctx);
	assert.ok(
		dow.some((c) => c.text.startsWith("New Martyrs and Confessors of Russian Church")),
		"New Martyrs of Russian Church should fire on Sun closest to Julian Jan 25",
	);
});

test("future year: Phase C4 composition works for 2030 (no vendored data)", () => {
	// 2030 Pascha = April 28 Greg. Sunday closest to Jan 25 Julian 2030:
	// Jan 25 Julian 2030 = Feb 7 Greg 2030 (Thursday). Closest Sun = Feb 10.
	const ctx = computeDayContext({ year: 2030, month: 2, day: 10 });
	assert.equal(ctx.julian.month, 1);
	assert.equal(ctx.julian.day, 28);
	assert.equal(ctx.dow, 0);
	const dow = getDowMovables(ctx);
	assert.ok(
		dow.some((c) => c.text.startsWith("New Martyrs and Confessors of Russian Church")),
		"DOW-nearest rule must work for arbitrary future years",
	);
});

test("future year: 2030 Julian Jan 1 returns Basil the Great (any year works)", () => {
	// 2030-01-14 is Julian Jan 1 (same 13-day gap).
	const ctx = computeDayContext({ year: 2030, month: 1, day: 14 });
	assert.equal(ctx.julian.month, 1);
	assert.equal(ctx.julian.day, 1);
	const fixed = getFixedCommemorations(ctx);
	assert.ok(
		fixed.some((c) => /Basil the Great/i.test(c.text)),
		"fixed-Julian table must work for any year",
	);
});
