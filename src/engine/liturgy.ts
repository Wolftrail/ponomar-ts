// Ported from Ponomar/DivineLiturgy1.java and the reading assembly in Ponomar/Main.java (typiconman/ponomar).
// Differences: the result is structured data, not HTML; placeholders for commemorations without a reading of the
// type are dropped; a neighbouring day with no Liturgy readings contributes none where upstream throws.

import { addDays, julianDate } from "../core/calendar/jdate.ts";
import { evaluateBoolean, type DslContext } from "../core/dsl/index.ts";
import { DIVINE_LITURGY_COMMANDS } from "../data/generated/rules.ts";
import { commemorationReadings } from "./commemoration.ts";
import { dayVariables, type GospelScheme, type JulianDay } from "./context.ts";
import { type ResolvedDay, resolveDayWithVariables } from "./day.ts";

export type LiturgyReadingType = "apostol" | "gospel";

/** One reading of the Liturgy. */
export interface LiturgyReading {
	/** A reference in the notation of the data, e.g. "I Cor_12:27-13:8a"; see `parseBibleReference`. */
	readonly reading: string;
	/** The commemoration's rank; -2 marks a sequential (daily) reading of the Pentecostarion cycle. */
	readonly rank: number;
	/** The commemoration the reading belongs to; absent for sequential readings. */
	readonly commemoration?: string;
	/** For a sequential reading, the weekday it belongs to: 0 is Sunday, and it differs from today's when transferred. */
	readonly weekday?: number;
}

export interface LiturgyReadings {
	readonly apostol: readonly LiturgyReading[];
	readonly gospel: readonly LiturgyReading[];
}

const SEQUENTIAL = -2;

interface Item {
	readonly reading: string;
	readonly rank: number;
	/** A commemoration id, or a weekday once the item is placed. */
	readonly tag: string | number;
}

interface Classified {
	daily: Item[];
	menaion: Item[];
	suppressed: Item[];
}

/** The `Value`s of the DivineLiturgy.xml commands called `name` whose own condition holds. */
function commandValues(name: string, context: DslContext): string[] {
	return DIVINE_LITURGY_COMMANDS.filter((c) => c.name === name && (c.cmd === undefined || evaluateBoolean(c.cmd, context))).map((c) => c.value);
}

/** Upstream consults only the first applicable value of the single-valued commands. */
function firstHolds(name: string, context: DslContext): boolean {
	const value = commandValues(name, context)[0];
	return value !== undefined && evaluateBoolean(value, context);
}

function anyHolds(name: string, context: DslContext): boolean {
	return commandValues(name, context).some((value) => evaluateBoolean(value, context));
}

/** `classifyReadings`: sequential readings are "daily"; the rest are the Menaion's. */
function classify(items: readonly Item[], context: DslContext): Classified {
	const result: Classified = { daily: [], menaion: [], suppressed: [] };
	for (const item of items) {
		(item.rank === SEQUENTIAL ? result.daily : result.menaion).push(item);
	}
	// Suppress rules drop the sequential readings outright, but only if something else is read that day.
	if (result.menaion.length > 0 && anyHolds("Suppress", context)) {
		result.daily = [];
		return result;
	}
	// Class3Transfers move them to the neighbouring day instead.
	if (anyHolds("Class3Transfers", context)) {
		result.suppressed = result.daily;
		result.daily = [];
	}
	return result;
}

interface Entry {
	readonly cid: string;
	readonly rank: number;
	readonly reading: string | undefined;
}

/** The commemorations with Liturgy readings (Menaion's first, then the Triodion's or Pentecostarion's), each with its reading of `type`. */
async function liturgyEntries(day: ResolvedDay, language: string, type: LiturgyReadingType): Promise<Entry[]> {
	const entries: Entry[] = [];
	for (const part of [day.menaion, day.paschal]) {
		for (const commemoration of part.commemorations) {
			const readings = await commemorationReadings(commemoration.cid, language, "liturgy", day.variables);
			if (Object.keys(readings).length > 0) {
				entries.push({ cid: commemoration.cid, rank: commemoration.rank, reading: readings[type]?.reading });
			}
		}
	}
	return entries;
}

/**
 * What a neighbouring day passes to today (`DivineLiturgy1.getReadings`). Its reading list omits commemorations
 * without a reading of the type, but ranks and tags keep every commemoration, so they pair up by position and
 * can fall out of step; this reproduces that.
 */
async function neighbourItems(date: JulianDay, today: DslContext, language: string, type: LiturgyReadingType): Promise<{ items: Item[]; context: DslContext }> {
	const variables = { ...dayVariables(date, today["GS"] as GospelScheme), Year: today["Year"]! };
	const neighbour = await resolveDayWithVariables(date, variables, language);
	const entries = await liturgyEntries(neighbour, language, type);
	const readings = entries.filter((e) => e.reading !== undefined);
	const items: Item[] = readings.map((e, k) => ({ reading: e.reading!, rank: entries[k]!.rank, tag: entries[k]!.cid }));
	return { items, context: { ...variables, dRank: neighbour.rank } };
}

function shift(date: JulianDay, days: number): JulianDay {
	const moved = addDays(julianDate(date.year, date.month, date.day), days);
	return { year: moved.year, month: moved.month, day: moved.day };
}

async function readingsOfType(day: ResolvedDay, language: string, type: LiturgyReadingType): Promise<LiturgyReading[]> {
	const entries = await liturgyEntries(day, language, type);
	// Upstream shows a type only when the first commemoration has it.
	if (entries.length === 0 || entries[0]!.reading === undefined || entries[0]!.reading === "") {
		return [];
	}
	const context: DslContext = { ...day.variables, dRank: day.rank };
	const dow = context["dow"]!;
	const today = classify(entries.map((e) => ({ reading: e.reading ?? "", rank: e.rank, tag: e.cid })), context);

	let yesterday: Classified = { daily: [], menaion: [], suppressed: [] };
	let tomorrow: Classified = { daily: [], menaion: [], suppressed: [] };
	if (firstHolds("Transfer", context)) {
		if (firstHolds("TransferRulesB", context)) {
			const next = await neighbourItems(shift(day.date, 1), context, language, type);
			tomorrow = classify(next.items, next.context);
		}
		if (firstHolds("TransferRulesF", context)) {
			const previous = await neighbourItems(shift(day.date, -1), context, language, type);
			yesterday = classify(previous.items, previous.context);
		}
	}

	const sequential: Item[] = [
		...yesterday.suppressed.map((item) => ({ ...item, tag: (dow - 1 + 7) % 7 })),
		...today.daily.map((item) => ({ ...item, tag: dow })),
		...tomorrow.suppressed.map((item) => ({ ...item, tag: (dow + 1) % 7 })),
	];
	// On Saturdays the Menaion comes first, and only the first sequential reading is added to it.
	const ordered = dow === 6 ? [...today.menaion, ...sequential.slice(0, 1)] : [...sequential, ...today.menaion];

	return ordered
		.filter((item) => item.reading !== "")
		.map((item) => (item.rank === SEQUENTIAL ? { reading: item.reading, rank: item.rank, weekday: item.tag as number } : { reading: item.reading, rank: item.rank, commemoration: String(item.tag) }));
}

/**
 * The Epistle and Gospel readings of the Divine Liturgy for a resolved day. Sequential readings that a feast
 * displaces are moved to the neighbouring day, as in Ponomar.
 */
export async function getLiturgyReadings(day: ResolvedDay, language: string): Promise<LiturgyReadings> {
	return { apostol: await readingsOfType(day, language, "apostol"), gospel: await readingsOfType(day, language, "gospel") };
}
