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

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { evaluateBool } from "../core/dsl/index.ts";
import { COMMEMORATIONS } from "../data/index.ts";
import type { Scripture, ServiceContext } from "../data/index.ts";
import { computeDayContext, dslContext } from "./day.ts";
import type { DayContext } from "./day.ts";
import { getHtocDailyLectionary } from "./dailyLectionary.ts";
import type { HourName } from "./hours.ts";
import { getLiturgicalDay } from "./index.ts";
import type { LiturgicalDay } from "./index.ts";
import { getResurrectionMatinsGospel } from "./matinsGospel.ts";
import type { ResolvedSaint } from "./resolve.ts";
import { getHtocSaintLectionary } from "./saintLectionary.ts";

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
	appendHtocDailyLectionary(day, opts, refs);
	appendHtocSaintLectionary(day, opts, refs);
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
 * gap using the codegen'd `HTOC_DAILY_LECTIONARY` table. Refs are tagged
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
function appendHtocDailyLectionary(
	day: LiturgicalDay,
	opts: GetDailyReadingsOptions,
	refs: ReadingRef[],
): void {
	if (opts.service !== undefined && opts.service !== "liturgy") return;
	const entries = getHtocDailyLectionary(day.context);
	if (entries === null) return;
	const htocByType = new Map<string, Set<string>>();
	for (const e of entries) {
		let s = htocByType.get(e.type);
		if (s === undefined) {
			s = new Set();
			htocByType.set(e.type, s);
		}
		s.add(e.reading);
	}
	for (let i = refs.length - 1; i >= 0; i--) {
		const r = refs[i]!;
		if (r.service !== "liturgy") continue;
		if (!isPonomarSequentialCid(r.cId)) continue;
		const htocReadings = htocByType.get(r.type);
		if (htocReadings === undefined) continue;
		if (htocReadings.has(r.reading)) continue;
		refs.splice(i, 1);
	}
	for (const e of entries) {
		if (opts.type !== undefined && opts.type !== e.type) continue;
		const dup = refs.some(
			(r) =>
				r.service === "liturgy" &&
				r.type === e.type &&
				r.reading === e.reading,
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

/**
 * Append the HTOC noted scriptures (saint-specific readings — Matins
 * Gospels, saint's Apostol/Gospel, Vespers Old-Testament readings, Hours)
 * for `day`. These come from the codegen'd `HTOC_SAINT_LECTIONARY` table,
 * which categorises every `note !== ""` HTOC scripture citation from the
 * corpus fixtures into `(service, type)` buckets.
 *
 * The upstream Ponomar XML gates most saint scriptures behind Cmd guards
 * that check `dRank`, which is sparse in the vendored data — so a lot of
 * genuine saint-day readings never fire. This appender fills the gap
 * additively (deduped against refs already emitted), keeping Ponomar's
 * own guards untouched.
 */
function appendHtocSaintLectionary(
	day: LiturgicalDay,
	opts: GetDailyReadingsOptions,
	refs: ReadingRef[],
): void {
	const entries = getHtocSaintLectionary(day.context.gregorian);
	if (entries === null) return;
	for (const e of entries) {
		if (opts.service !== undefined && opts.service !== e.service) continue;
		if (opts.type !== undefined && opts.type !== e.type) continue;
		const dup = refs.some(
			(r) =>
				r.service === e.service &&
				r.type === e.type &&
				r.reading === e.reading,
		);
		if (dup) continue;
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
		(r) => r.service === "matins" && r.type === "gospel",
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
