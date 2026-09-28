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
export { getLiturgicalDay, getDailyReadings, getLiturgyReadings, getFasting } from "./engine/index.ts";
export type {
	LiturgicalDay,
	DailyReadings,
	ReadingRef,
	FastingResult,
	FastingLevel,
	FastingPermissions,
} from "./engine/index.ts";
