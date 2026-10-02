/**
 * ponomar-ts — TypeScript port of the Ponomar Orthodox liturgics engine.
 *
 * This top-level entry re-exports every stable public module. Prefer deep
 * imports (`ponomar-ts/paschalion`) for smaller bundles when possible.
 *
 * @packageDocumentation
 */

export * from "./paschalion.ts";
export * as jdate from "./core/calendar/jdate.ts";
export * as pcalendar from "./core/calendar/pcalendar.ts";
export * as dsl from "./core/dsl/index.ts";
export * as data from "./data/index.ts";
export * as engine from "./engine/index.ts";
export * as bible from "./bible/index.ts";
export * as astronomy from "./astronomy/index.ts";
export { getLiturgicalDay, getDailyReadings, getLiturgyReadings, getFasting, getFastingPeriod, renderFastText, getFastingPeriodName, getOctoechosTone, getLiturgicalSeason, getPentecostWeek, getLentenWeek, isSviatki, renderHeaderText, getCommemorationsForAnyYear, getDowMovables, getFixedCommemorations, getPaschalMovables, getSeasonCommemorations, getTransferOverlays, isVendoredDate, DAILY_LECTIONARY, SAINTS_BY_ISO, DAY_FACTS_BY_ISO, SAINT_LECTIONARY, SAINT_FIXED_CYCLE, SAINT_MOVABLE_CYCLE, SAINT_EXCEPTIONS, cIdToSlug, getLifeBySlug, getSaint, getSaintByCId, slugToCId, getReadings, getDay, getSaints, getSaintsAnyYear, getDailyLectionary, getSaintLectionary } from "./engine/index.ts";
export type {
	LiturgicalDay,
	DailyReadings,
	ReadingRef,
	FastingResult,
	FastingLevel,
	FastingPermissions,
	FastingPeriod,
	FastingPeriodKind,
	ServiceDirective,
	ServiceTemplate,
	ServiceTitle,
	Phrase,
	DailyLectionaryEntry,
	Saint,
	Commemoration,
	DayFacts,
	Hymn,
	SaintCommemoration,
	SaintProfile,
} from "./engine/index.ts";
export { parseBibleRef, formatBibleRef, findBook, BibleRefError } from "./bible/index.ts";
export type { BibleBook, BibleRef, VerseEndpoint, VerseRange } from "./bible/index.ts";
export {
	SunAltitude,
	formatClock,
	getSunriseSunset,
	LUNAR_MONTH,
	LUNAR_HALF_DAY,
	getLunarCycle,
	getLunarPhase,
	getLunarPhaseName,
	getNextNewMoon,
	getNextFullMoon,
} from "./astronomy/index.ts";
export type {
	SunriseSunsetOptions,
	SunriseSunsetResult,
	LunarPhaseName,
} from "./astronomy/index.ts";
