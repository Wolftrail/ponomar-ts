// Ported from Ponomar/Main.java write() and Ponomar/Day.java (typiconman/ponomar).

import { evaluate, evaluateBoolean, type DslContext } from "../core/dsl/index.ts";
import { type DayCycle, findDayFile } from "../data/access.ts";
import type { DayFile } from "../data/types.ts";
import { dayVariables, type GospelScheme, type JulianDay } from "./context.ts";
import { commemorationRank } from "./rank.ts";

/** What `Day.getDayRank` reports for a day with no commemorations. */
export const NO_RANK = -100;

export interface ResolvedCommemoration {
	/** Saint ids; empty when the day file gives none. */
	readonly sid: readonly string[];
	/** Names the commemoration's life files. */
	readonly cid: string;
	readonly rank: number;
}

/** The commemorations one day file contributes. */
export interface ResolvedPart {
	readonly cycle: DayCycle;
	/** "MM-DD" for the menaion, the file number for the triodion and pentecostarion. */
	readonly file: string | number;
	/** Whether a day file exists for it; upstream treats a missing file as an empty day. */
	readonly found: boolean;
	readonly commemorations: readonly ResolvedCommemoration[];
	/** The highest commemoration rank, or NO_RANK. */
	readonly rank: number;
	/** Tone of the last entry that sets one, with 0 reported as 8; -1 when none does. */
	readonly tone: number;
}

export interface ResolvedDay {
	readonly date: JulianDay;
	readonly variables: DslContext;
	/** The Triodion or Pentecostarion part, chosen by distance from Pascha. */
	readonly paschal: ResolvedPart;
	readonly menaion: ResolvedPart;
	/** The higher of the two parts' ranks. */
	readonly rank: number;
	/** The Octoechos tone, taken from the paschal part as upstream does; -1 when unset. */
	readonly tone: number;
}

export interface ResolveDayOptions {
	/** A date on the Julian calendar; convert Gregorian dates first (see `pcalendar.fromGregorian`). */
	readonly date: JulianDay;
	/** Language directory such as "en", "cu/ru" or "el/mono"; selects data and rank refinements. */
	readonly language: string;
	/** Defaults to the Jordanville lectionary (0). */
	readonly gospelScheme?: GospelScheme;
}

function paschalFile(nday: number, ndayP: number): { cycle: "triodion" | "pentecostarion"; file: number } {
	if (nday >= -70 && nday < 0) {
		return { cycle: "triodion", file: Math.abs(nday) };
	}
	// Before the Triodion the Pentecostarion continues from last year's Pascha.
	return { cycle: "pentecostarion", file: nday < -70 ? ndayP + 1 : nday + 1 };
}

async function resolvePart(
	cycle: DayCycle,
	key: string | number,
	file: DayFile | undefined,
	language: string,
	context: DslContext,
): Promise<ResolvedPart> {
	const commemorations: ResolvedCommemoration[] = [];
	let tone = -1;
	for (const saint of file ?? []) {
		if (saint.cmd !== undefined && !evaluateBoolean(saint.cmd, context)) {
			continue;
		}
		if (saint.tone !== undefined) {
			tone = Math.floor(evaluate(saint.tone, context));
		}
		commemorations.push({ sid: saint.sid, cid: saint.cid, rank: await commemorationRank(saint.cid, language, context) });
	}
	return {
		cycle,
		file: key,
		found: file !== undefined,
		commemorations,
		rank: commemorations.reduce((highest, c) => Math.max(highest, c.rank), NO_RANK),
		tone: tone === 0 ? 8 : tone,
	};
}

export async function resolveDay(options: ResolveDayOptions): Promise<ResolvedDay> {
	const { date, language } = options;
	return resolveDayWithVariables(date, dayVariables(date, options.gospelScheme ?? 0), language);
}

/** As `resolveDay`, with the day's variables given: upstream resolves a neighbouring day with its own variables but today's `Year`. */
export async function resolveDayWithVariables(date: JulianDay, variables: DslContext, language: string): Promise<ResolvedDay> {
	const selected = paschalFile(variables["nday"]!, variables["ndayP"]!);
	const menaionKey = `${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;

	const paschal = await resolvePart(selected.cycle, selected.file, await findDayFile(selected.cycle, language, selected.file), language, variables);
	const menaion = await resolvePart("menaion", menaionKey, await findDayFile("menaion", language, menaionKey), language, variables);
	return { date, variables, paschal, menaion, rank: Math.max(paschal.rank, menaion.rank), tone: paschal.tone };
}
