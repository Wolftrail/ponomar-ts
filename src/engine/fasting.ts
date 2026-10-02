// Compute the day's fasting rule.
//
// Walks the ordered `<PERIOD>` list from Commands/Fasting.xml
// (`FASTING_RULES`). For each period whose `Cmd` guard passes, iterate its
// `<RULE>` entries in document order; the last-matching rule's `Case`
// bitstring wins. Later periods override earlier ones (the trailing
// unguarded PERIOD is the "special rules throughout the year" bucket).
//
// Ported from Ponomar/Fasting.java.

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { evaluateBool } from "../core/dsl/index.ts";
import { FASTING_RULES } from "../data/index.ts";
import type { DayContext } from "./day.ts";
import { dslContext } from "./day.ts";
import { getLiturgicalDay } from "./index.ts";

/** The 7-character `Case` bitstring from a `<RULE>` element. Bit positions
 * (leftmost = 0) map to `meat`, `dairy`, `fish`, `caviar`, `oil`,
 * `cookedFood`, `food` respectively; a `1` means "permitted". */
export type FastingCase = string;

/** One of the nine canonical fasting patterns, or `custom` for anything else. */
export type FastingLevel =
	| "no-food"
	| "strict"
	| "no-oil"
	| "oil"
	| "caviar"
	| "fish"
	| "meat-excluded"
	| "no-fast"
	| "wine"
	| "custom";

export interface FastingPermissions {
	readonly meat: boolean;
	readonly dairy: boolean;
	readonly fish: boolean;
	readonly caviar: boolean;
	readonly oil: boolean;
	readonly cookedFood: boolean;
	readonly food: boolean;
}

export interface FastingResult {
	readonly context: DayContext;
	readonly case: FastingCase;
	readonly level: FastingLevel;
	readonly permitted: FastingPermissions;
	/** True when the day fell into no matching period at all (default = no-fast). */
	readonly isDefault: boolean;
}

const CANONICAL: ReadonlyMap<FastingCase, FastingLevel> = new Map([
	["0000000", "no-food"],
	["0000001", "strict"],
	["0000010", "wine"],
	["0000011", "no-oil"],
	["0000111", "oil"],
	["0001111", "caviar"],
	["0011111", "fish"],
	["0111111", "meat-excluded"],
	["1111111", "no-fast"],
]);

/** Compute today's fasting rule for a Gregorian date. */
export function getFasting(gregorian: CalendarDate): FastingResult {
	const day = getLiturgicalDay(gregorian);
	return computeFastingFromContext(day.context, day.dRank);
}

/** Lower-level fasting computation that takes a pre-built `DayContext` and
 *  `dRank` directly. Used by callers (e.g. `getLiturgicalDay`) that have
 *  already computed those values and would otherwise cause recursion if
 *  they called `getFasting` directly. */
export function computeFastingFromContext(
	ctx: DayContext,
	dRank: number,
): FastingResult {
	const vars = dslContext(ctx, { dRank });
	let winner: FastingCase | null = null;
	for (const period of FASTING_RULES) {
		if (period.cmd !== undefined && !evaluateBool(period.cmd, vars)) continue;
		for (const rule of period.rules) {
			if (rule.cmd !== undefined && !evaluateBool(rule.cmd, vars)) continue;
			winner = rule.case;
		}
	}
	const isDefault = winner === null;
	const code = winner ?? "1111111";
	return {
		context: ctx,
		case: code,
		level: CANONICAL.get(code) ?? "custom",
		permitted: parsePermissions(code),
		isDefault,
	};
}

function parsePermissions(code: FastingCase): FastingPermissions {
	return {
		meat: code[0] === "1",
		dairy: code[1] === "1",
		fish: code[2] === "1",
		caviar: code[3] === "1",
		oil: code[4] === "1",
		cookedFood: code[5] === "1",
		food: code[6] === "1",
	};
}
