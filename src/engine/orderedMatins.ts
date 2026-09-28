// Canonical ordering for Matins (Orthros) scripture readings.
//
// Ported from Ponomar/Matins.java `Suppress()`. Unlike Divine Liturgy, matins
// has no `Commands/Matins.xml` — all conflict-resolution rules are hard-coded
// upstream. There are exactly two, both firing only on Sundays:
//
//   1. `dow == 0 && dRank > 6 && (nday < -49 || nday > 0)`
//      A high-rank feast falls on a Sunday outside Great-Lent-through-Pascha:
//      the paschal-cycle ("sequential") resurrection gospel yields entirely
//      to the feast; suppressed refs move to `suppressed`.
//
//   2. `dow == 0 && dRank <= 6`
//      A quiet Sunday: the paschal resurrection gospel wins; any menaion
//      matins reading yields and moves to `suppressed`.
//
// On non-Sundays the two categories coexist unchanged.
//
// **Not** implemented (matching upstream, which also skips these for matins):
//   * cross-day recursion for transferred readings;
//   * `Suppress` command lookup — Matins.java's `LeapReadings()` reads from a
//     shared "Information2" table populated by DivineLiturgy1; in practice the
//     upstream corpus's active Matins.xml commands set is empty.

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { getDailyReadings } from "./readings.ts";
import type { ReadingRef } from "./readings.ts";
import { getLiturgicalDay } from "./index.ts";
import type { DayContext } from "./day.ts";

/** A matins reading tagged for ordering. `rank=sequential` mirrors upstream's
 *  `dailyV/R/T` bucket (paschal-cycle resurrection gospels); `festal` mirrors
 *  `menaionV/R/T`. */
export interface OrderedMatinsReading extends ReadingRef {
	readonly rank: "sequential" | "festal";
}

export interface OrderedMatinsReadings {
	readonly context: DayContext;
	/** Matins refs actually read today, in insertion order. */
	readonly refs: readonly OrderedMatinsReading[];
	/** Refs the Sunday rank rules pushed aside — displayable as "transferred"
	 *  or simply ignored. */
	readonly suppressed: readonly OrderedMatinsReading[];
}

export function getOrderedMatinsReadings(
	gregorian: CalendarDate,
): OrderedMatinsReadings {
	const day = getLiturgicalDay(gregorian);
	const raw = getDailyReadings(gregorian, { service: "matins" }).refs;
	const dow = day.context.dow;
	const nday = day.context.nday;
	const dRank = day.dRank;

	const classified: OrderedMatinsReading[] = raw.map((r) => ({
		...r,
		rank: r.source === "paschal" ? "sequential" : "festal",
	}));

	const refs: OrderedMatinsReading[] = [];
	const suppressed: OrderedMatinsReading[] = [];

	const highRankSundayFeast =
		dow === 0 && dRank > 6 && (nday < -49 || nday > 0);
	const quietSunday = dow === 0 && dRank <= 6;

	for (const r of classified) {
		if (highRankSundayFeast && r.rank === "sequential") {
			suppressed.push(r);
			continue;
		}
		if (quietSunday && r.rank === "festal") {
			suppressed.push(r);
			continue;
		}
		refs.push(r);
	}

	return { context: day.context, refs, suppressed };
}
