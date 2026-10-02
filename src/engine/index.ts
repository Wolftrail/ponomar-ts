// Top-level public API for the day-info engine.
//
// This composes the day-context calculator, the DayEntry lookups
// (pentecostarion / triodion / menaion) and the DSL-guard filter into one
// call. It answers: "for this Gregorian date, which saints are commemorated,
// and what is the paschal-cycle context?"

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import type { DayContext } from "./day.ts";
import { computeDayContext } from "./day.ts";
import { computeFastingFromContext } from "./fasting.ts";
import type { FastingResult } from "./fasting.ts";
import { getDayFacts, isVendoredDate } from "./dayFacts.ts";
import type { Commemoration, Hymn } from "./dayFacts.ts";
import { getHymnsForAnyYear } from "./hymns.ts";
import { projectCommemorations } from "./projection.ts";
import { getDayRank, getSaintsFor, unmapRank } from "./saints.ts";
import type { Saint } from "./saints.ts";
import { selectMenaionEntry, selectPaschalCycleEntry } from "./lookup.ts";
import type { ResolvedSaint } from "./resolve.ts";
import { resolveSaints } from "./resolve.ts";

/** Result of `getLiturgicalDay`. */
export interface LiturgicalDay {
	readonly context: DayContext;
	/** Primary saint commemoration list, HTOC-faithful. For dates in the
	 *  vendored HTOC coverage window (2025–2030) this is HTOC's own list
	 *  verbatim. For dates outside, it is projected from the Ponomar
	 *  structural lists below (with the HTOC name overlay applied to
	 *  `text`). Prefer this for display. */
	readonly saints: readonly Saint[];
	/** Full commemoration list as published on HTOC's day page — the
	 *  authoritative "what HTOC prints today" list including entries without
	 *  a navigable life page (e.g. New Hieromartyrs, Fast Day markers, minor
	 *  Greek/Celtic/Russian commemorations). Superset of
	 *  {@link LiturgicalDay.saints}, which is the cId-linked navigable subset.
	 *  Within the vendored HTOC window (2025–2030) this is HTOC's own list
	 *  verbatim; outside the window it is composed algorithmically via
	 *  `getCommemorationsForAnyYear` (fixed-Julian + paschal/triodion-movable
	 *  + DOW-shift + season markers + per-year transfer overlays). */
	readonly commemorations: readonly Commemoration[];
	/** HTOC's header line, e.g. `"28 th Week after Pentecost. Tone two."`.
	 *  Within the vendored HTOC window (2025–2030) this is HTOC's printed
	 *  header verbatim; outside the window it is composed algorithmically
	 *  via `renderHeaderText`. */
	readonly headerText: string;
	/** Structured fasting rule for the day: the 7-bit permission `case`,
	 *  the canonical `level` (`"strict"` / `"oil"` / `"fish"` / ...),
	 *  explicit `permitted` flags, and the multi-day `period` the day
	 *  falls in. Replaces the pre-rc.19 string `fastText`; consumers who
	 *  want an English label can use `renderFastText(context, fasting.level)`
	 *  from `./fastText.ts`. */
	readonly fasting: FastingResult;
	/** Day's troparia as published by HTOC (titles + text + saint linkage
	 *  via `slug` to `saints[].slug`). Empty for dates outside the
	 *  vendored HTOC coverage window. */
	readonly troparia: readonly Hymn[];
	/** Day's kontakia as published by HTOC. See the note on
	 *  {@link LiturgicalDay.troparia}. */
	readonly kontakia: readonly Hymn[];
	/** Structural saints from the paschal cycle (pentecostarion / triodion),
	 *  Cmd-filtered. Keyed by Ponomar `cId`; carries `tone` and `church.rank`.
	 *  Used internally for `dRank`, `tone`, readings, and propers; prefer
	 *  {@link LiturgicalDay.saints} for user-facing display. */
	readonly paschalSaints: readonly ResolvedSaint[];
	/** Structural saints from the fixed Menaion at Julian MM-DD, Cmd-filtered.
	 *  See the note on {@link LiturgicalDay.paschalSaints}. */
	readonly menaionSaints: readonly ResolvedSaint[];
	/** HTOC's published commemoration list projected into `ResolvedSaint`
	 *  shape: `cId` is synthetic (`htoc:<slug>` or `htoc:anon:<slug>`),
	 *  `name.nominative` is HTOC's printed text, and `church.rank` comes
	 *  from HTOC's own rank glyph via {@link mapRank}. Order mirrors
	 *  HTOC's day page. This is the authoritative "who is commemorated
	 *  today" list; use {@link LiturgicalDay.paschalSaints} /
	 *  {@link LiturgicalDay.menaionSaints} when you need Ponomar's
	 *  structural cIds (e.g. to look up readings or hymns in the XML
	 *  corpus). */
	readonly allSaints: readonly ResolvedSaint[];
	/** Highest `church.rank` across the Ponomar structural lists
	 *  (`paschalSaints` ∪ `menaionSaints`). Matches upstream
	 *  `Math.max(SolarCycle.getDayRank(), PaschalCycle.getDayRank())` and
	 *  drives service/template selection. See {@link LiturgicalDay.saintsDRank}
	 *  for HTOC's own rank ceiling. */
	readonly dRank: number;
	/** Highest rank across `saints` on Ponomar's numeric scale (via
	 *  `mapRank`). `0` when HTOC has no ranked commemoration. */
	readonly saintsDRank: number;
	/** Resurrectional tone of the week (1..8), or `null` outside the
	 * eight-tone cycle (Great Lent, Bright Week, Great Feasts of the Lord).
	 * Within the vendored HTOC window (2025–2030) this is HTOC's printed
	 * tone verbatim; outside the window it is the algorithmic
	 * `getOctoechosTone` (validated 100% against the vendored corpus),
	 * with upstream `Day.getTone()` as a final fallback. */
	readonly tone: number | null;
}

export function getLiturgicalDay(gregorian: CalendarDate): LiturgicalDay {
	const context = computeDayContext(gregorian);
	const paschal = selectPaschalCycleEntry(context);
	const menaion = selectMenaionEntry(context);
	const paschalSaints = paschal ? resolveSaints(paschal, context) : [];
	const menaionSaints = menaion ? resolveSaints(menaion, context) : [];
	const structural: readonly ResolvedSaint[] = [...paschalSaints, ...menaionSaints];
	const covered = getSaintsFor(gregorian);
	const saints: readonly Saint[] = covered !== null
		? covered
		: projectPonomarSaints(paschalSaints, menaionSaints);
	const saintsDRank = covered !== null ? getDayRank(gregorian) : 0;
	const facts = getDayFacts(gregorian);
	const headerText = facts.headerText;
	const commemorations = facts.commemorations;
	const allSaints = projectCommemorations(commemorations);
	let dRank = 0;
	let toneRaw: number | null = null;
	for (const s of structural) {
		if (s.church?.rank !== undefined && s.church.rank > dRank) {
			dRank = s.church.rank;
		}
		// Upstream Day.java line 161: last SAINT with a Tone attribute wins;
		// `-1` is the sentinel "unset" so we skip it.
		if (s.tone !== null && s.tone !== -1) toneRaw = s.tone;
	}
	const engineTone = toneRaw === null ? null : toneRaw === 0 ? 8 : toneRaw;
	// Within the vendored HTOC window, use the published tone verbatim
	// (including `null` on Bright Week / Great Feasts). Outside the window,
	// `facts.tone` is the algorithmic `getOctoechosTone`, which matches
	// HTOC on the entire vendored corpus; we still fall through to
	// `engineTone` as a last resort for parity with the pre-Phase-D
	// behaviour on sparse menaion days.
	const tone = isVendoredDate(gregorian)
		? facts.tone
		: (facts.tone ?? engineTone);
	// Outside the vendored window, HTOC publication fields (troparia,
	// kontakia) are empty by default. Compose them algorithmically from
	// the position-stable cycle maps so year 2028+ gets near-full HTOC
	// fidelity.
	let troparia = facts.troparia;
	let kontakia = facts.kontakia;
	if (!isVendoredDate(gregorian)) {
		const hymns = getHymnsForAnyYear(context, tone);
		troparia = hymns.troparia;
		kontakia = hymns.kontakia;
	}
	const fasting = computeFastingFromContext(context, dRank);
	return {
		context,
		saints,
		commemorations,
		headerText,
		fasting,
		troparia,
		kontakia,
		paschalSaints,
		menaionSaints,
		allSaints,
		dRank,
		saintsDRank,
		tone,
	};
}

/** Project Ponomar `ResolvedSaint`s into the HTOC `Saint` shape so that
 *  `LiturgicalDay.saints` is populated for dates outside HTOC's vendored
 *  coverage window. `text` uses the HTOC-overlaid `nominative` wording when
 *  available (otherwise upstream Ponomar wording), and the slug is a
 *  synthetic `ponomar/<cId>` to make the projection round-trippable. */
function projectPonomarSaints(
	paschalSaints: readonly ResolvedSaint[],
	menaionSaints: readonly ResolvedSaint[],
): Saint[] {
	const out: Saint[] = [];
	for (const s of paschalSaints) out.push(toSaint(s, "movable"));
	for (const s of menaionSaints) out.push(toSaint(s, "fixed"));
	return out;
}

function toSaint(
	s: ResolvedSaint,
	cycle: "fixed" | "movable",
): Saint {
	const text = s.name?.nominative ?? s.name?.short ?? "";
	const short = s.name?.short;
	return {
		slug: `ponomar/${s.cId}`,
		cycle,
		names: short !== undefined && short !== "" ? [short] : [],
		rank: unmapRank(s.church?.rank ?? 0),
		text,
	};
}

export type { DayContext } from "./day.ts";
export type { ResolvedSaint } from "./resolve.ts";
export type {
	Church,
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
export type { DailyLectionaryEntry } from "./dailyLectionary.ts";
export { DAILY_LECTIONARY } from "./dailyLectionary.ts";
export type { Saint } from "./saints.ts";
export { SAINTS_BY_ISO } from "./saints.ts";
export type { Commemoration, DayFacts, Hymn } from "./dayFacts.ts";
export { DAY_FACTS_BY_ISO, isVendoredDate } from "./dayFacts.ts";
export type { SaintLectionaryEntry } from "./saintLectionary.ts";
export { SAINT_LECTIONARY } from "./saintLectionary.ts";

// --- HTOC-first facade. These are the canonical public names.
export type { SaintCommemoration, SaintProfile } from "./saints.ts";
export {
	cIdToSlug,
	getLifeBySlug,
	getSaint,
	getSaintByCId,
	slugToCId,
} from "./saints.ts";
export { getReadings } from "./readings.ts";
export { getDayFacts as getDay } from "./dayFacts.ts";
export { getSaintsFor as getSaints } from "./saints.ts";
export { getSaintsForAnyYear as getSaintsAnyYear } from "./saints.ts";
export {
	SAINT_FIXED_CYCLE,
	SAINT_MOVABLE_CYCLE,
	SAINT_EXCEPTIONS,
} from "./saints.ts";
export { getDailyLectionary } from "./dailyLectionary.ts";
export { getSaintLectionary as getSaintLectionary } from "./saintLectionary.ts";
export type {
	FastingCase,
	FastingLevel,
	FastingPermissions,
	FastingPeriod,
	FastingPeriodKind,
	FastingResult,
} from "./fasting.ts";
export { getFasting, getFastingPeriod } from "./fasting.ts";
export { renderFastText, getFastingPeriodName } from "./fastText.ts";
export {
	getOctoechosTone,
	isToneSuppressed,
	rawOctoechosTone,
} from "./tone.ts";
export type { SeasonKind } from "./season.ts";
export {
	getLentenWeek,
	getLiturgicalSeason,
	getPentecostWeek,
	isSviatki,
} from "./season.ts";
export { renderHeaderText } from "./headerText.ts";
export {
	getCommemorationsForAnyYear,
	getDowMovables,
	getFixedCommemorations,
	getPaschalMovables,
	getSeasonCommemorations,
	getTransferOverlays,
} from "./commemorations.ts";
export type {
	BibleDirective,
	CreateDirective,
	GetDirective,
	Phrase,
	ServiceDirective,
	ServiceTemplate,
	ServiceTitle,
} from "../data/types.ts";
