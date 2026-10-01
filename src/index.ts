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
export { getLiturgicalDay, getDailyReadings, getLiturgyReadings, getFasting, getOrderedLiturgyReadings, getServices, getPropers, getOrderedMatinsReadings, composeService, getHourService, getPhrase, resolveCreate, resolveCommand, resolveBibleHeader, resolveTitle, getResurrectionMatinsGospel, RESURRECTION_MATINS_GOSPELS, getHtocDailyLectionary, HTOC_DAILY_LECTIONARY, getHtocReadings, getHtocSaintsFor, getHtocDayRank, mapHtocRank, unmapHtocRank, HTOC_SAINTS_BY_ISO, getHtocDayFacts, HTOC_DAY_FACTS_BY_ISO, HTOC_SAINT_LECTIONARY, getHtocSaintLectionary, cIdToSlug, getLifeBySlug, getSaint, getSaintByCId, slugToCId, getReadings, getDay, getSaints, getDailyLectionary, getSaintLectionary } from "./engine/index.ts";
export type {
	LiturgicalDay,
	DailyReadings,
	ReadingRef,
	FastingResult,
	FastingLevel,
	FastingPermissions,
	OrderedLiturgyReadings,
	OrderedReading,
	HourSelection,
	ServicesResult,
	DailyPropers,
	OrderedMatinsReading,
	OrderedMatinsReadings,
	ComposedService,
	ComposeServiceOptions,
	HourName,
	HourServiceResult,
	GetHourServiceOptions,
	ServiceDirective,
	ServiceTemplate,
	ServiceTitle,
	Phrase,
	ResolvedTitle,
	ResurrectionMatinsGospel,
	HtocDailyLectionaryEntry,
	HtocSaint,
	HtocCommemoration,
	HtocDayFacts,
	HtocHymn,
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
