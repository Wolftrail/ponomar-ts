// Ported from Ponomar/Fasting.java (typiconman/ponomar).
// Differences: the level is also returned as structured data; a day with no applicable rule yields no sentence
// instead of upstream's "Error calculating fast information" fallthrough.

import { evaluateBoolean, type DslContext } from "../core/dsl/index.ts";
import { FASTING } from "../data/generated/rules.ts";
import { getPhraseList } from "../data/language.ts";
import type { ResolvedDay } from "./day.ts";

/** Foods in the order of a fasting level's seven digits, each "1" when permitted. */
export const FASTING_FOODS = ["meat", "dairy", "fish", "caviar", "oil", "wine", "dryFood"] as const;
export type FastingFood = (typeof FASTING_FOODS)[number];

export interface FastingResult {
	/** Seven digits, e.g. "0000111" (wine and oil allowed); see Fasting.xml for the common ones. */
	readonly level: string;
	readonly permitted: readonly FastingFood[];
	readonly forbidden: readonly FastingFood[];
}

/**
 * The fasting level for a day: every period whose condition holds is searched, and the last rule whose
 * condition holds sets the level. `context` must carry the resolved day rank as `dRank`.
 */
export function getFastingLevel(context: DslContext): string | undefined {
	let level: string | undefined;
	for (const period of FASTING) {
		if (period.cmd !== undefined && !evaluateBoolean(period.cmd, context)) {
			continue;
		}
		for (const rule of period.rules) {
			if (rule.cmd === undefined || evaluateBoolean(rule.cmd, context)) {
				level = rule.level;
			}
		}
	}
	return level;
}

export function describeFastingLevel(level: string): FastingResult {
	const permitted: FastingFood[] = [];
	const forbidden: FastingFood[] = [];
	FASTING_FOODS.forEach((food, i) => (level[i] === "1" ? permitted : forbidden).push(food));
	return { level, permitted, forbidden };
}

export function getFasting(context: DslContext): FastingResult | undefined {
	const level = getFastingLevel(context);
	return level === undefined ? undefined : describeFastingLevel(level);
}

/** The fasting for a resolved day, using its rank as upstream does. */
export function getDayFasting(day: ResolvedDay): FastingResult | undefined {
	return getFasting({ ...day.variables, dRank: day.rank });
}

// Indices into the language pack's "Fasts" phrase, as Fasting.convert uses them.
const NAMED_LEVELS: Readonly<Record<string, readonly number[]>> = {
	"0000000": [4, 1, 6, 7],
	"0000001": [4, 1, 6, 8],
	"0000011": [4, 1, 6, 9],
	"0000111": [4, 2],
	"0001111": [4, 10],
	"0011111": [4, 3],
	"0111111": [4, 11],
	"1111111": [4, 0],
	"0000010": [4, 12],
};

/** The sentence upstream shows for a level, built from the language's "Fasts" phrase; undefined if it has none. */
export async function renderFastingLevel(level: string, language: string): Promise<string | undefined> {
	const names = await getPhraseList(language, "Fasts");
	if (names === undefined) {
		return undefined;
	}
	const named = NAMED_LEVELS[level];
	if (named !== undefined) {
		return named.map((i) => names[i]).join("");
	}

	const items = [13, 14, 15, 16, 17, 18, 19].map((i) => names[i]!);
	const permitted = items.filter((_, i) => level[i] === "1");
	const forbidden = items.filter((_, i) => level[i] !== "1");
	const list = (foods: readonly string[]): string =>
		foods.map((food, i) => food + (i < foods.length - 1 ? ", " : "") + (i === foods.length - 2 ? ` ${names[25]} ` : "")).join("");
	// Singular, dual (for Slavonic) and plural verb forms.
	const verb = (count: number): string => (count === 1 ? names[20]! : count === 2 ? names[21]! : names[22]!);

	let output = `${names[27]} ${list(permitted)} ${verb(permitted.length)} ${names[23]}${names[26]} ${list(forbidden)}`;
	// Upstream appends the whole sentence to itself when exactly one food is forbidden (`output += output += ...`).
	if (forbidden.length === 1) {
		output += output;
	}
	output += ` ${forbidden.length === 1 ? names[20] : verb(forbidden.length)} ${names[24]}`;
	return `${names[4]} ${output}`;
}
