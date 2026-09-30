// Canonical ordering for Divine Liturgy readings.
//
// Ported from Ponomar/DivineLiturgy1.java (`Readings()` and `classifyReadings`).
// Consults `DIVINE_LITURGY_COMMANDS` (from Commands/DivineLiturgy.xml) to:
//   * classify each ref as `sequential` (movable-cycle placeholder,
//     cId ∈ [9000, 9899]) or `festal` (menaion or high-rank floater);
//   * evaluate the `Suppress` commands — matching sequential refs are
//     dropped entirely (Nativity, Theophany, their eves, etc.);
//   * evaluate the `Class3Transfers` commands — matching sequential refs
//     move to a separate `suppressed` bucket, meaning "not read today
//     but consumers may want to display / transfer them" (Royal Hours
//     Friday, Exaltation, Transfiguration on non-Sundays, etc.);
//   * apply the Saturday inversion: festal first on dow === 6,
//     sequential first otherwise;
//   * evaluate the `Transfer` + `TransferRulesB` + `TransferRulesF`
//     commands to pull sequential readings across day boundaries
//     (upstream's "Lucan jump" recursion). Refs pulled from yesterday
//     are prepended; refs pulled from tomorrow are appended. Every ref
//     carries a `dowOrigin` tag naming which day it was scheduled for.
//
// **Not** yet implemented:
//   * rank-aware `<SERVICE Type="N">` selection (rank data too sparse
//     across the current corpus to matter);
//   * mirroring upstream's `dRank = 0` override for the recursive
//     lookup of adjacent days. In practice only 6/3371 cIds carry a
//     rank at all, so the deviation is inert on today's data.

import { addDays } from "../core/calendar/pcalendar.ts";
import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { evaluateBool } from "../core/dsl/index.ts";
import { DIVINE_LITURGY_COMMANDS } from "../data/index.ts";
import { dslContext } from "./day.ts";
import type { DayContext } from "./day.ts";
import { getLiturgicalDay } from "./index.ts";
import { getLiturgyReadings } from "./readings.ts";
import type { ReadingRef } from "./readings.ts";

/** A liturgy reading tagged with its classification for ordering. */
export interface OrderedReading extends ReadingRef {
	readonly rank: "sequential" | "festal";
	/** Day-of-week (0 = Sunday … 6 = Saturday) the reading was originally
	 *  scheduled for. Equals `context.dow` for today's own readings; differs
	 *  when the ref was cross-day-transferred from yesterday or tomorrow. */
	readonly dowOrigin: number;
}

export interface OrderedLiturgyReadings {
	readonly context: DayContext;
	/** Apostol readings in canonical order (festal first on Saturday, sequential first otherwise). */
	readonly apostol: readonly OrderedReading[];
	/** Gospel readings in canonical order. */
	readonly gospel: readonly OrderedReading[];
	/**
	 * Sequential readings the upstream Typicon considers "not read today":
	 * either dropped by a `Suppress` command or moved out by
	 * `Class3Transfers`. Consumers can display these as "transferred" or
	 * ignore them entirely.
	 */
	readonly suppressed: readonly OrderedReading[];
	/** All non-suppressed refs, apostol then gospel, in canonical order. */
	readonly refs: readonly OrderedReading[];
}

/** Compute the Divine Liturgy apostol + gospel refs for a Gregorian date. */
export function getOrderedLiturgyReadings(
	gregorian: CalendarDate,
): OrderedLiturgyReadings {
	return computeOrdered(gregorian, true);
}

/** Internal worker. `crossDay=false` disables the Transfer/TransferRules
 *  recursion so the adjacent-day lookup can't recurse further. */
function computeOrdered(
	gregorian: CalendarDate,
	crossDay: boolean,
): OrderedLiturgyReadings {
	const day = getLiturgicalDay(gregorian);
	const dow = day.context.dow;
	const vars = dslContext(day.context, { dRank: day.dRank });
	const raw = getLiturgyReadings(gregorian).refs;

	const suppressAll = evalCommand("Suppress", vars);
	const class3 = evalCommand("Class3Transfers", vars);

	const apostol = classify(raw, "apostol", dow);
	const gospel = classify(raw, "gospel", dow);

	const suppressed: OrderedReading[] = [];
	const apostolKept = filterAndDrain(apostol, suppressAll, class3, suppressed);
	const gospelKept = filterAndDrain(gospel, suppressAll, class3, suppressed);

	const saturday = dow === 6;
	let apostolOrdered = orderRefs(apostolKept, saturday);
	let gospelOrdered = orderRefs(gospelKept, saturday);

	if (crossDay && evalCommand("Transfer", vars)) {
		// TransferRulesF: today accepts yesterday's transferred readings
		// (i.e. readings scheduled for yesterday but moved forward to today).
		if (evalCommand("TransferRulesF", vars)) {
			const yr = computeOrdered(addDays(gregorian, -1), false);
			apostolOrdered = [
				...pickByType(yr.suppressed, "apostol"),
				...apostolOrdered,
			];
			gospelOrdered = [
				...pickByType(yr.suppressed, "gospel"),
				...gospelOrdered,
			];
		}
		// TransferRulesB: today accepts tomorrow's transferred readings
		// (i.e. readings scheduled for tomorrow but moved backward to today).
		if (evalCommand("TransferRulesB", vars)) {
			const tr = computeOrdered(addDays(gregorian, 1), false);
			apostolOrdered = [
				...apostolOrdered,
				...pickByType(tr.suppressed, "apostol"),
			];
			gospelOrdered = [
				...gospelOrdered,
				...pickByType(tr.suppressed, "gospel"),
			];
		}
	}

	return {
		context: day.context,
		apostol: apostolOrdered,
		gospel: gospelOrdered,
		suppressed,
		refs: [...apostolOrdered, ...gospelOrdered],
	};
}

function classify(
	refs: readonly ReadingRef[],
	type: string,
	dow: number,
): OrderedReading[] {
	const out: OrderedReading[] = [];
	for (const r of refs) {
		if (r.type !== type) continue;
		out.push({ ...r, rank: rankOf(r.cId), dowOrigin: dow });
	}
	return out;
}

function filterAndDrain(
	refs: readonly OrderedReading[],
	suppressAll: boolean,
	class3: boolean,
	drainTo: OrderedReading[],
): OrderedReading[] {
	const kept: OrderedReading[] = [];
	for (const r of refs) {
		if (r.rank === "sequential" && (suppressAll || class3)) {
			if (class3 && !suppressAll) drainTo.push(r);
			continue;
		}
		kept.push(r);
	}
	return kept;
}

function orderRefs(
	refs: readonly OrderedReading[],
	saturday: boolean,
): OrderedReading[] {
	const sequential = refs.filter((r) => r.rank === "sequential");
	const festal = refs.filter((r) => r.rank === "festal");
	return saturday ? [...festal, ...sequential] : [...sequential, ...festal];
}

function pickByType(
	refs: readonly OrderedReading[],
	type: "apostol" | "gospel",
): OrderedReading[] {
	return refs.filter((r) => r.type === type);
}

function rankOf(cId: string): "sequential" | "festal" {
	// HTOC daily-lectionary override picks are the rjadovoje readings — the
	// direct analogue of the 9xxx sequential placeholders — and must sort
	// under the "sequential" bucket for Saturday inversion and Suppress /
	// Class3Transfers evaluation to behave correctly.
	if (cId === "htoc:daily-lectionary") return "sequential";
	if (!/^\d+$/.test(cId)) return "festal";
	const n = parseInt(cId, 10);
	return n >= 9000 && n < 9900 && cId.length === 4 ? "sequential" : "festal";
}

/** Evaluate every DIVINE_LITURGY_COMMANDS row named `name`; return `true` on the
 * first row whose outer `Cmd` gate AND inner `Value` DSL both evaluate true. */
function evalCommand(
	name: string,
	vars: Readonly<Record<string, number>>,
): boolean {
	for (const cmd of DIVINE_LITURGY_COMMANDS) {
		if (cmd.name !== name) continue;
		if (cmd.cmd !== undefined && !evaluateBool(cmd.cmd, vars)) continue;
		if (evaluateBool(cmd.value, vars)) return true;
	}
	return false;
}
