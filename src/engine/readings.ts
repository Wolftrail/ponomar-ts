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
import { getLiturgicalDay } from "./index.ts";
import type { ResolvedSaint } from "./resolve.ts";

export interface ReadingRef {
	readonly cId: string;
	readonly source: "paschal" | "menaion";
	readonly service: ServiceContext;
	/** SCRIPTURE `Type` attribute (`apostol` / `gospel` / `matins` / ...). */
	readonly type: string;
	readonly reading: string;
	readonly pericope?: string;
	readonly note?: string;
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
	const vars = dslContext(day.context);
	const refs: ReadingRef[] = [];
	collectFrom(day.paschalSaints, "paschal", vars, opts, refs);
	collectFrom(day.menaionSaints, "menaion", vars, opts, refs);
	return { context: day.context, refs };
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
