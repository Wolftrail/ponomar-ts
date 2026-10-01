// Top-level public API for the day-info engine.
//
// This composes the day-context calculator, the DayEntry lookups
// (pentecostarion / triodion / menaion) and the DSL-guard filter into one
// call. It answers: "for this Gregorian date, which saints are commemorated,
// and what is the paschal-cycle context?"

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import type { DayContext } from "./day.ts";
import { computeDayContext } from "./day.ts";
import { getHtocDayRank, getHtocSaintsFor, unmapHtocRank } from "./htocSaints.ts";
import type { HtocSaint } from "./htocSaints.ts";
import { selectMenaionEntry, selectPaschalCycleEntry } from "./lookup.ts";
import type { ResolvedSaint } from "./resolve.ts";
import { resolveSaints } from "./resolve.ts";

/** Result of `getLiturgicalDay`. */
export interface LiturgicalDay {
	readonly context: DayContext;
	/** Primary saint commemoration list, HTOC-faithful. For dates in the
	 *  vendored HTOC coverage window (2025–2027) this is HTOC's own list
	 *  verbatim. For dates outside, it is projected from the Ponomar
	 *  structural lists below (with the HTOC name overlay applied to
	 *  `text`). Prefer this for display. */
	readonly saints: readonly HtocSaint[];
	/** Structural saints from the paschal cycle (pentecostarion / triodion),
	 *  Cmd-filtered. Keyed by Ponomar `cId`; carries `tone` and `church.rank`.
	 *  Used internally for `dRank`, `tone`, readings, and propers; prefer
	 *  {@link LiturgicalDay.saints} for user-facing display. */
	readonly paschalSaints: readonly ResolvedSaint[];
	/** Structural saints from the fixed Menaion at Julian MM-DD, Cmd-filtered.
	 *  See the note on {@link LiturgicalDay.paschalSaints}. */
	readonly menaionSaints: readonly ResolvedSaint[];
	/** Union of {@link LiturgicalDay.paschalSaints} then
	 *  {@link LiturgicalDay.menaionSaints}, in that order. Structural; see
	 *  the note on {@link LiturgicalDay.paschalSaints}. */
	readonly allSaints: readonly ResolvedSaint[];
	/** Highest `church.rank` across `allSaints` (0 if none). Matches upstream
	 * `Math.max(SolarCycle.getDayRank(), PaschalCycle.getDayRank())`. */
	readonly dRank: number;
	/** Highest rank across `saints` on Ponomar's numeric scale (via
	 *  `mapHtocRank`). `0` when HTOC has no ranked commemoration. */
	readonly htocDRank: number;
	/** Resurrectional tone of the week (1..8), or `null` outside the
	 * eight-tone cycle (Great Lent, Bright Week, Great Feasts of the Lord).
	 * Matches upstream `Day.getTone()` — the last `<SAINT Tone="…">` value
	 * encountered in paschal-then-menaion order, with `0` wrapped to `8`. */
	readonly tone: number | null;
}

export function getLiturgicalDay(gregorian: CalendarDate): LiturgicalDay {
	const context = computeDayContext(gregorian);
	const paschal = selectPaschalCycleEntry(context);
	const menaion = selectMenaionEntry(context);
	const paschalSaints = paschal ? resolveSaints(paschal, context) : [];
	const menaionSaints = menaion ? resolveSaints(menaion, context) : [];
	const allSaints = [...paschalSaints, ...menaionSaints];
	const htocCovered = getHtocSaintsFor(gregorian);
	const saints: readonly HtocSaint[] = htocCovered !== null
		? htocCovered
		: projectPonomarSaints(paschalSaints, menaionSaints);
	const htocDRank = htocCovered !== null ? getHtocDayRank(gregorian) : 0;
	let dRank = 0;
	let toneRaw: number | null = null;
	for (const s of allSaints) {
		if (s.church?.rank !== undefined && s.church.rank > dRank) {
			dRank = s.church.rank;
		}
		// Upstream Day.java line 161: last SAINT with a Tone attribute wins;
		// `-1` is the sentinel "unset" so we skip it.
		if (s.tone !== null && s.tone !== -1) toneRaw = s.tone;
	}
	const tone = toneRaw === null ? null : toneRaw === 0 ? 8 : toneRaw;
	return {
		context,
		saints,
		paschalSaints,
		menaionSaints,
		allSaints,
		dRank,
		htocDRank,
		tone,
	};
}

/** Project Ponomar `ResolvedSaint`s into the HTOC `HtocSaint` shape so that
 *  `LiturgicalDay.saints` is populated for dates outside HTOC's vendored
 *  coverage window. `text` uses the HTOC-overlaid `nominative` wording when
 *  available (otherwise upstream Ponomar wording), and the slug is a
 *  synthetic `ponomar/<cId>` to make the projection round-trippable. */
function projectPonomarSaints(
	paschalSaints: readonly ResolvedSaint[],
	menaionSaints: readonly ResolvedSaint[],
): HtocSaint[] {
	const out: HtocSaint[] = [];
	for (const s of paschalSaints) out.push(toHtocSaint(s, "movable"));
	for (const s of menaionSaints) out.push(toHtocSaint(s, "fixed"));
	return out;
}

function toHtocSaint(
	s: ResolvedSaint,
	cycle: "fixed" | "movable",
): HtocSaint {
	const text = s.name?.nominative ?? s.name?.short ?? "";
	const short = s.name?.short;
	return {
		slug: `ponomar/${s.cId}`,
		cycle,
		names: short !== undefined && short !== "" ? [short] : [],
		rank: unmapHtocRank(s.church?.rank ?? 0),
		text,
	};
}

export type { DayContext } from "./day.ts";
export { computeDayContext, dslContext } from "./day.ts";
export { selectMenaionEntry, selectPaschalCycleEntry } from "./lookup.ts";
export type { ResolvedSaint } from "./resolve.ts";
export { resolveSaints } from "./resolve.ts";
export type {
	Church,
	Commemoration,
	Hymn,
	Life,
	SaintInfo,
	SaintName,
} from "../data/types.ts";
export type {
	DailyReadings,
	GetDailyReadingsOptions,
	ReadingRef,
} from "./readings.ts";
export { getDailyReadings, getLiturgyReadings } from "./readings.ts";
export type { ResurrectionMatinsGospel } from "./matinsGospel.ts";
export {
	RESURRECTION_MATINS_GOSPELS,
	getResurrectionMatinsGospel,
} from "./matinsGospel.ts";
export type { HtocDailyLectionaryEntry } from "./dailyLectionary.ts";
export {
	HTOC_DAILY_LECTIONARY,
	getHtocDailyLectionary,
} from "./dailyLectionary.ts";
export type { HtocSaint } from "./htocSaints.ts";
export {
	HTOC_SAINTS_BY_ISO,
	getHtocSaintsFor,
	getHtocDayRank,
	mapHtocRank,
	unmapHtocRank,
} from "./htocSaints.ts";
export type {
	FastingCase,
	FastingLevel,
	FastingPermissions,
	FastingResult,
} from "./fasting.ts";
export { getFasting } from "./fasting.ts";
export type {
	OrderedLiturgyReadings,
	OrderedReading,
} from "./orderedLiturgy.ts";
export { getOrderedLiturgyReadings } from "./orderedLiturgy.ts";
export type { HourSelection, ServicesResult } from "./services.ts";
export { getServices } from "./services.ts";
export type {
	DailyPropers,
	GetPropersOptions,
	ProperRef,
} from "./propers.ts";
export { getPropers } from "./propers.ts";
export type {
	OrderedMatinsReading,
	OrderedMatinsReadings,
} from "./orderedMatins.ts";
export { getOrderedMatinsReadings } from "./orderedMatins.ts";
export type { ComposedService, ComposeServiceOptions } from "./compose.ts";
export { composeService } from "./compose.ts";
export type {
	GetHourServiceOptions,
	HourName,
	HourReadings,
	HourServiceResult,
} from "./hours.ts";
export { getHourReadings, getHourService } from "./hours.ts";
export type { ResolvedTitle } from "./phrases.ts";
export {
	getPhrase,
	resolveBibleHeader,
	resolveCommand,
	resolveCreate,
	resolveTitle,
} from "./phrases.ts";
export type {
	BibleDirective,
	CreateDirective,
	GetDirective,
	Phrase,
	ServiceDirective,
	ServiceTemplate,
	ServiceTitle,
} from "../data/types.ts";
