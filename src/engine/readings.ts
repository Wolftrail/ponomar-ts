// Given a Gregorian date, return the scripture readings for the day.
//
// This is the first cut of `getDailyReadings`: for each commemorated saint,
// look up their `Commemoration` record, filter its `Scripture` entries by
// the DSL `Cmd` guard (in the day-context), and collect them tagged with
// their source (paschal cycle or menaion).
//
// **Not** yet ported from upstream `DivineLiturgy1.Readings()`:
//   * ordering per the DivineLiturgy.xml command list
//   * Saturday menaion↔paschal inversion
//   * skipped-reading transfer to the next weekday (the "Lucan jump")
//   * cross-day recursion for transferred readings
// Consumers who need the canonical Divine Liturgy sequence should treat the
// result as unordered until Phase 5+ lands the ordering logic.

import { BibleRefError, parseBibleRef } from "../bible/parse.ts";
import type { BibleRef } from "../bible/types.ts";
import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { evaluateBool } from "../core/dsl/index.ts";
import { COMMEMORATIONS } from "../data/index.ts";
import type { Scripture, ServiceContext } from "../data/index.ts";
import { computeDayContext, dslContext } from "./day.ts";
import type { DayContext } from "./day.ts";
import { getDailyLectionary } from "./dailyLectionary.ts";
import type { HourName } from "./hours.ts";
import { getLiturgicalDay } from "./index.ts";
import type { LiturgicalDay } from "./index.ts";
import { getResurrectionMatinsGospel } from "./matinsGospel.ts";
import type { ResolvedSaint } from "./resolve.ts";
import { getSaintLectionary } from "./saintLectionary.ts";

export interface ReadingRef {
	readonly cId: string;
	readonly source: "paschal" | "menaion" | "cycle" | "htoc";
	readonly service: ServiceContext;
	/** SCRIPTURE `Type` attribute (`apostol` / `gospel` / `matins` / ...). */
	readonly type: string;
	readonly reading: string;
	readonly pericope?: string;
	readonly note?: string;
	/** Little Hour this reading is assigned to when the source note names one
	 *  (Royal Hours 1st/3rd/6th/9th, Lenten 6th-hour prophecies). */
	readonly hour?: HourName;
}

export interface DailyReadings {
	readonly context: DayContext;
	readonly refs: readonly ReadingRef[];
}

export interface GetDailyReadingsOptions {
	/** Only include SCRIPTURE entries nested in this service block. */
	readonly service?: ServiceContext;
	/** Only include SCRIPTURE entries whose `Type` attribute matches. */
	readonly type?: string;
}

export function getDailyReadings(
	gregorian: CalendarDate,
	opts: GetDailyReadingsOptions = {},
): DailyReadings {
	const day = getLiturgicalDay(gregorian);
	const vars = dslContext(day.context, { dRank: day.dRank });
	const refs: ReadingRef[] = [];
	collectFrom(day.paschalSaints, "paschal", vars, opts, refs);
	collectFrom(day.menaionSaints, "menaion", vars, opts, refs);
	appendResurrectionMatinsGospel(day, opts, refs);
	appendDailyLectionary(day, opts, refs);
	appendSaintLectionary(day, opts, refs);
	return { context: day.context, refs };
}

/**
 * Append the HTOC (ROCOR/Jordanville-recension) daily rjadovoje Liturgy
 * readings for `day`, deduping against refs already emitted by the paschal
 * and menaion data passes.
 *
 * Ponomar's XML encodes the Moscow Patriarchate Slavonic recension, which
 * disagrees with HTOC on ~180 ordinary weekday gospels per year (mostly
 * driven by a different Lucan-Jump convention). This appender fills the
 * gap using the codegen'd `DAILY_LECTIONARY` table. Refs are tagged
 * `source: "htoc"` for downstream visibility.
 *
 * The HTOC pick for a given `(liturgy, type)` slot is authoritative under
 * Russian / ROCOR practice. Where the Ponomar paschal/menaion sequential
 * (cId in 9000..9899) emitted earlier disagrees with HTOC — i.e. its
 * reading isn't among HTOC's published picks for that type — the Ponomar
 * ref is evicted so the two don't appear side by side as duplicate
 * "ordinary" liturgy readings. When Ponomar's sequential reading does
 * match one of HTOC's picks (common on days where HTOC publishes multiple
 * pairs — the ordinary + a transferred one), the Ponomar ref is kept.
 */
function appendDailyLectionary(
	day: LiturgicalDay,
	opts: GetDailyReadingsOptions,
	refs: ReadingRef[],
): void {
	if (opts.service !== undefined && opts.service !== "liturgy") return;
	const entries = getDailyLectionary(day.context);
	if (entries === null) return;
	const byType = new Map<string, Set<string>>();
	for (const e of entries) {
		let s = byType.get(e.type);
		if (s === undefined) {
			s = new Set();
			byType.set(e.type, s);
		}
		s.add(normalizeReadingForDedup(e.reading));
	}
	for (let i = refs.length - 1; i >= 0; i--) {
		const r = refs[i]!;
		if (r.service !== "liturgy") continue;
		if (!isPonomarSequentialCid(r.cId)) continue;
		const readings = byType.get(r.type);
		if (readings === undefined) continue;
		if (readings.has(normalizeReadingForDedup(r.reading))) continue;
		refs.splice(i, 1);
	}
	for (const e of entries) {
		if (opts.type !== undefined && opts.type !== e.type) continue;
		const normalized = normalizeReadingForDedup(e.reading);
		const dup = refs.some(
			(r) =>
				r.service === "liturgy" &&
				r.type === e.type &&
				normalizeReadingForDedup(r.reading) === normalized,
		);
		if (dup) continue;
		refs.push({
			cId: "htoc:daily-lectionary",
			source: "htoc",
			service: "liturgy",
			type: e.type,
			reading: e.reading,
		});
	}
}

/** Mirrors `orderedLiturgy.ts#rankOf` — 4-digit cIds in 9000..9899 are the
 *  movable-cycle sequential placeholders. */
function isPonomarSequentialCid(cId: string): boolean {
	if (cId.length !== 4 || !/^\d+$/.test(cId)) return false;
	const n = parseInt(cId, 10);
	return n >= 9000 && n < 9900;
}

/** Strip Ponomar's `a`/`b`/… verse-part suffixes so e.g.
 *  `Jn_19:6-11a, 13-20, 25-28a, 30b-35a` and HTOC's
 *  `Jn_19:6-11, 13-20, 25-28, 30-35` compare equal for dedup.
 *
 *  When the resulting string parses as a `BibleRef`, we canonicalize
 *  further by returning `book|ranges` using the parser's resolved book id
 *  and expanded same-chapter ranges. This makes the two Ponomar book-name
 *  styles that otherwise defeat dedup compare equal:
 *    - menaion XML uses `id` (e.g. `Philip_2:5-11`, `I_Cor_...`);
 *    - the HTOC saint-lectionary codegen uses `short`
 *      (e.g. `Phil_2:5-11`, `I Cor_...`);
 *  and the shorthand/explicit chapter-prefix variants that HTOC emits
 *  (e.g. `Lk_10:38-42, 11:27-28` vs `Lk_10:38-42, 11:27-11:28`). */
function normalizeReadingForDedup(reading: string): string {
	const stripped = reading.replace(/(\d)[a-z]+/g, "$1");
	try {
		const ref = parseBibleRef(stripped);
		return canonicalRefKey(ref);
	} catch (e) {
		if (e instanceof BibleRefError) return stripped;
		throw e;
	}
}

/** Dedup-only key: `book|whole:C` for whole-chapter refs, or
 *  `book|C1:V1-C2:V2,...` for ranged refs. Matches
 *  `scripts/analysis/comparators.ts#refKey`. */
function canonicalRefKey(ref: BibleRef): string {
	if (ref.ranges.length === 0) return `${ref.book}|whole:${ref.chapter}`;
	const parts = ref.ranges.map(
		(r) =>
			`${r.start.chapter}:${r.start.verse}-${r.end.chapter}:${r.end.verse}`,
	);
	return `${ref.book}|${parts.join(",")}`;
}

/** Menaion/triodion/pentecostarion encode festal matins gospels as
 *  `type="1"` and resurrection-cycle Sunday matins gospels (9057, 9064, …)
 *  as `type="matins"`; HTOC's saint-lectionary and the resurrection-cycle
 *  fallback use `type="gospel"`. Great Friday additionally uses `type="2"`
 *  through `type="12"` for the twelve Passion Gospels. Treat all these
 *  as the same slot for matins dedup / HTOC filtering so the sources
 *  don't both surface. */
function isMatinsGospelType(type: string): boolean {
	return type === "gospel" || type === "matins" || /^\d+$/.test(type);
}

/**
 * Append the HTOC noted scriptures (saint-specific readings — Matins
 * Gospels, saint's Apostol/Gospel, Vespers Old-Testament readings, Hours)
 * for `day`. These come from the codegen'd `SAINT_LECTIONARY` table,
 * which categorises every `note !== ""` HTOC scripture citation from the
 * corpus fixtures into `(service, type)` buckets.
 *
 * The upstream Ponomar XML gates most saint scriptures behind Cmd guards
 * that check `dRank`, which is sparse in the vendored data — so a lot of
 * genuine saint-day readings never fire. This appender fills the gap
 * additively (deduped against refs already emitted), keeping Ponomar's
 * own guards untouched.
 */
function appendSaintLectionary(
	day: LiturgicalDay,
	opts: GetDailyReadingsOptions,
	refs: ReadingRef[],
): void {
	const entries = getSaintLectionary(day.context.gregorian);
	if (entries === null) return;
	for (const e of entries) {
		if (opts.service !== undefined && opts.service !== e.service) continue;
		if (opts.type !== undefined && opts.type !== e.type) continue;
		const normalized = normalizeReadingForDedup(e.reading);
		// Dedup on (service, reading) only — ignore the type sub-field.
		// Ponomar labels each slot structurally (matins/1..12, primes/1..3)
		// while HTOC flattens them (matins/gospel, primes/reading); the
		// same ceremonial pericope at the same service is one reading.
		const dupIdx = refs.findIndex(
			(r) =>
				r.service === e.service &&
				normalizeReadingForDedup(r.reading) === normalized,
		);
		if (dupIdx >= 0) {
			// Preserve HTOC's hour/note metadata on the surviving ref so
			// downstream consumers (getHourReadings, UI note display) still
			// see the Royal-Hour tag and reading-title note.
			const existing = refs[dupIdx]!;
			const addHour = e.hour !== undefined && existing.hour === undefined;
			const addNote = e.note !== undefined && existing.note === undefined;
			if (addHour || addNote) {
				refs[dupIdx] = {
					...existing,
					...(addHour ? { hour: e.hour } : {}),
					...(addNote ? { note: e.note } : {}),
				};
			}
			continue;
		}
		refs.push({
			cId: "htoc:saint-lectionary",
			source: "htoc",
			service: e.service as ServiceContext,
			type: e.type,
			reading: e.reading,
			note: e.note,
			...(e.hour !== undefined ? { hour: e.hour } : {}),
		});
	}
}

/**
 * On Sundays where the data-driven pass yields no matins gospel, emit the
 * resurrectional 11-cycle pericope. Ponomar's vendored XML does not ship
 * the 11-pericope table itself, so this fallback fills in what upstream
 * would otherwise leave blank. No-op when either filter (`service`/`type`)
 * excludes matins gospels, or when a matins gospel already exists.
 */
function appendResurrectionMatinsGospel(
	day: LiturgicalDay,
	opts: GetDailyReadingsOptions,
	refs: ReadingRef[],
): void {
	if (opts.service !== undefined && opts.service !== "matins") return;
	if (opts.type !== undefined && opts.type !== "gospel") return;
	const hasMatinsGospel = refs.some(
		(r) => r.service === "matins" && isMatinsGospelType(r.type),
	);
	if (hasMatinsGospel) return;
	const cycle = getResurrectionMatinsGospel(day.context, day.dRank);
	if (cycle === null) return;
	refs.push({
		cId: "cycle:matins-gospel",
		source: "cycle",
		service: "matins",
		type: "gospel",
		reading: cycle.reading,
	});
}

function collectFrom(
	saints: readonly ResolvedSaint[],
	source: "paschal" | "menaion",
	vars: Readonly<Record<string, number>>,
	opts: GetDailyReadingsOptions,
	out: ReadingRef[],
): void {
	for (const s of saints) {
		const commem = COMMEMORATIONS[s.cId];
		if (commem === undefined) continue;
		for (const sc of commem.scriptures) {
			if (opts.service !== undefined && sc.service !== opts.service) continue;
			if (opts.type !== undefined && sc.type !== opts.type) continue;
			if (sc.cmd !== undefined && !evaluateBool(sc.cmd, vars)) continue;
			out.push(toRef(s.cId, source, sc));
		}
	}
}

function toRef(
	cId: string,
	source: "paschal" | "menaion",
	sc: Scripture,
): ReadingRef {
	return {
		cId,
		source,
		service: sc.service,
		type: sc.type,
		reading: sc.reading,
		...(sc.pericope !== undefined ? { pericope: sc.pericope } : {}),
		...(sc.note !== undefined ? { note: sc.note } : {}),
	};
}

/** Convenience: only the LITURGY scriptures for a Gregorian date. */
export function getLiturgyReadings(gregorian: CalendarDate): DailyReadings {
	return getDailyReadings(gregorian, { service: "liturgy" });
}

export type { CalendarDate } from "../core/calendar/pcalendar.ts";
export { computeDayContext };

// --- HTOC-only scripture view ---------------------------------------
// (Formerly src/engine/htocReadings.ts; merged on prefix removal.)
// HTOC-only scripture view — filters `getDailyReadings` down to the
// pericopes HTOC's day page publishes (daily rjadovoje liturgy pair +
// matins gospel + any noted saint-lectionary / Royal Hours entries).
// Pure derivation on top of the main engine; no fixture-window gate.
// Inside the vendored 2025–2027 corpus, HTOC-tagged refs provide
// ground-truth output; outside that window the Ponomar algorithm fills
// in from menaion/triodion/pentecostarion/paschalion data.

/** Return every scripture HTOC's day page would publish for `gregorian`:
 *  liturgy apostol+gospel, matins gospel, and any noted entry (Royal
 *  Hours, saint's apostol/gospel, Vespers OT prophecy). For in-window
 *  dates (2025–2027) the result matches HTOC's published feed verbatim;
 *  for out-of-window dates it is the Ponomar algorithm's best
 *  approximation using the same underlying menaion data. */
export function getReadings(gregorian: CalendarDate): readonly ReadingRef[] {
	const refs = getDailyReadings(gregorian).refs;
	return refs.filter(
		(r) =>
			r.source === "htoc" ||
			r.service === "liturgy" ||
			(r.service === "matins" && isMatinsGospelType(r.type)) ||
			r.hour !== undefined,
	);
}

