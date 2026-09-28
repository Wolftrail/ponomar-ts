// Service selection for the four Little Hours.
//
// Ported from Ponomar/ServiceInfo.java + Commands/ServiceRules.xml. Each
// `<PERIOD>` in the rules XML covers a stretch of the liturgical year;
// inside it, `<PRIME>` / `<TERCE>` / `<SEXTE>` / `<NONE>` rules each carry
// template attributes (`Type`, `Troparion`, `PickT`, `Kontakion`, `PickK`,
// `LENTENK`) plus an optional DSL guard. Upstream's algorithm walks every
// rule whose guard passes and merges its attributes into the running
// selection — last write per attribute wins.
//
// This module returns the merged selection; it does not compose the
// actual liturgical text (that belongs to Phase 8, which will consume
// `HourSelection` together with tone / menaion / pentecostarion data).

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { evaluateBool } from "../core/dsl/index.ts";
import { SERVICE_RULES } from "../data/index.ts";
import type { ServiceRule } from "../data/index.ts";
import { dslContext } from "./day.ts";
import type { DayContext } from "./day.ts";
import { getLiturgicalDay } from "./index.ts";

/** Merged template selection for a single Little Hour. Attributes accumulate
 *  from every rule inside a matching `<PERIOD>` whose own `Cmd` (if any) passes;
 *  when multiple rules touch the same attribute, the later one wins. */
export interface HourSelection {
	readonly type: string;
	readonly troparion?: string;
	readonly pickT?: string;
	readonly kontakion?: string;
	readonly pickK?: string;
	readonly lentenK?: string;
}

export interface ServicesResult {
	readonly context: DayContext;
	readonly prime: HourSelection | undefined;
	readonly terce: HourSelection | undefined;
	readonly sexte: HourSelection | undefined;
	readonly none: HourSelection | undefined;
}

/** Compute the selection for each of the four Little Hours on a Gregorian date. */
export function getServices(gregorian: CalendarDate): ServicesResult {
	const day = getLiturgicalDay(gregorian);
	const vars = dslContext(day.context, { dRank: day.dRank });

	let prime: HourSelection | undefined;
	let terce: HourSelection | undefined;
	let sexte: HourSelection | undefined;
	let none: HourSelection | undefined;

	for (const period of SERVICE_RULES) {
		if (period.cmd !== undefined && !evaluateBool(period.cmd, vars)) continue;
		prime = mergeAll(prime, period.prime, vars);
		terce = mergeAll(terce, period.terce, vars);
		sexte = mergeAll(sexte, period.sexte, vars);
		none = mergeAll(none, period.none, vars);
	}

	return { context: day.context, prime, terce, sexte, none };
}

function mergeAll(
	current: HourSelection | undefined,
	rules: readonly ServiceRule[],
	vars: Readonly<Record<string, number>>,
): HourSelection | undefined {
	let acc = current;
	for (const rule of rules) {
		if (rule.cmd !== undefined && !evaluateBool(rule.cmd, vars)) continue;
		acc = mergeRule(acc, rule);
	}
	return acc;
}

function mergeRule(
	current: HourSelection | undefined,
	rule: ServiceRule,
): HourSelection {
	const base: HourSelection = current ?? { type: rule.type };
	const next: HourSelection = {
		type: rule.type,
		...(base.troparion !== undefined ? { troparion: base.troparion } : {}),
		...(base.pickT !== undefined ? { pickT: base.pickT } : {}),
		...(base.kontakion !== undefined ? { kontakion: base.kontakion } : {}),
		...(base.pickK !== undefined ? { pickK: base.pickK } : {}),
		...(base.lentenK !== undefined ? { lentenK: base.lentenK } : {}),
		...(rule.troparion !== undefined ? { troparion: rule.troparion } : {}),
		...(rule.pickT !== undefined ? { pickT: rule.pickT } : {}),
		...(rule.kontakion !== undefined ? { kontakion: rule.kontakion } : {}),
		...(rule.pickK !== undefined ? { pickK: rule.pickK } : {}),
		...(rule.lentenK !== undefined ? { lentenK: rule.lentenK } : {}),
	};
	return next;
}
