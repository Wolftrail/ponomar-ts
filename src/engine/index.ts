// Top-level public API for the day-info engine.
//
// This composes the day-context calculator, the DayEntry lookups
// (pentecostarion / triodion / menaion) and the DSL-guard filter into one
// call. It answers: "for this Gregorian date, which saints are commemorated,
// and what is the paschal-cycle context?"

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import type { DayContext } from "./day.ts";
import { computeDayContext } from "./day.ts";
import { selectMenaionEntry, selectPaschalCycleEntry } from "./lookup.ts";
import type { ResolvedSaint } from "./resolve.ts";
import { resolveSaints } from "./resolve.ts";

/** Result of `getLiturgicalDay`. */
export interface LiturgicalDay {
	readonly context: DayContext;
	/** Saints from the paschal cycle (pentecostarion or triodion), Cmd-filtered. */
	readonly paschalSaints: readonly ResolvedSaint[];
	/** Saints from the fixed Menaion at Julian MM-DD, Cmd-filtered. */
	readonly menaionSaints: readonly ResolvedSaint[];
	/** Union of paschalSaints then menaionSaints, in that order. */
	readonly allSaints: readonly ResolvedSaint[];
	/** Highest `church.rank` across `allSaints` (0 if none). Matches upstream
	 * `Math.max(SolarCycle.getDayRank(), PaschalCycle.getDayRank())`. */
	readonly dRank: number;
}

export function getLiturgicalDay(gregorian: CalendarDate): LiturgicalDay {
	const context = computeDayContext(gregorian);
	const paschal = selectPaschalCycleEntry(context);
	const menaion = selectMenaionEntry(context);
	const paschalSaints = paschal ? resolveSaints(paschal, context) : [];
	const menaionSaints = menaion ? resolveSaints(menaion, context) : [];
	const allSaints = [...paschalSaints, ...menaionSaints];
	let dRank = 0;
	for (const s of allSaints) {
		if (s.church?.rank !== undefined && s.church.rank > dRank) {
			dRank = s.church.rank;
		}
	}
	return {
		context,
		paschalSaints,
		menaionSaints,
		allSaints,
		dRank,
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
