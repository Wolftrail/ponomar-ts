// Given a Gregorian date, return the hymnographic propers (troparia and
// kontakia) for the day.
//
// Analogous to `getDailyReadings` but for `<TROPARION>` / `<KONTAKION>`
// records captured from lives XML. Each hymn's optional DSL `Cmd` guard is
// evaluated against the day context; hymns are tagged with their source
// (paschal cycle vs. menaion) and returned in insertion order.
//
// **Not** ported from upstream:
//   * Service.java template composition (which weaves troparia, kontakia,
//     stichera, ikoi, etc. into a full order-of-service string). This module
//     surfaces only the raw hymn data; callers are expected to compose it.
//   * Cross-day propers transfer analogous to the Lucan jump.

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { evaluateBool } from "../core/dsl/index.ts";
import { COMMEMORATIONS } from "../data/index.ts";
import type { Hymn, ServiceContext } from "../data/index.ts";
import type { DayContext } from "./day.ts";
import { dslContext } from "./day.ts";
import { getLiturgicalDay } from "./index.ts";
import type { ResolvedSaint } from "./resolve.ts";

/** A single hymn resolved to a specific date, tagged with its source. */
export interface ProperRef {
	readonly cId: string;
	readonly source: "paschal" | "menaion";
	readonly kind: "troparion" | "kontakion";
	readonly service: ServiceContext;
	readonly type?: string;
	readonly tone?: string;
	readonly podoben?: string;
	readonly body: string;
}

export interface DailyPropers {
	readonly context: DayContext;
	readonly troparia: readonly ProperRef[];
	readonly kontakia: readonly ProperRef[];
}

export interface GetPropersOptions {
	/** Only include hymns nested in this service block. */
	readonly service?: ServiceContext;
	/** Only include hymns of this kind. */
	readonly kind?: "troparion" | "kontakion";
}

export function getPropers(
	gregorian: CalendarDate,
	opts: GetPropersOptions = {},
): DailyPropers {
	const day = getLiturgicalDay(gregorian);
	const vars = dslContext(day.context, { dRank: day.dRank });
	const troparia: ProperRef[] = [];
	const kontakia: ProperRef[] = [];
	collectFrom(day.paschalSaints, "paschal", vars, opts, troparia, kontakia);
	collectFrom(day.menaionSaints, "menaion", vars, opts, troparia, kontakia);
	return { context: day.context, troparia, kontakia };
}

function collectFrom(
	saints: readonly ResolvedSaint[],
	source: "paschal" | "menaion",
	vars: Readonly<Record<string, number>>,
	opts: GetPropersOptions,
	troparia: ProperRef[],
	kontakia: ProperRef[],
): void {
	for (const s of saints) {
		const commem = COMMEMORATIONS[s.cId];
		if (commem === undefined) continue;
		for (const h of commem.hymns) {
			if (opts.service !== undefined && h.service !== opts.service) continue;
			if (opts.kind !== undefined && h.kind !== opts.kind) continue;
			if (h.cmd !== undefined && !evaluateBool(h.cmd, vars)) continue;
			const ref = toRef(s.cId, source, h);
			if (h.kind === "troparion") troparia.push(ref);
			else kontakia.push(ref);
		}
	}
}

function toRef(
	cId: string,
	source: "paschal" | "menaion",
	h: Hymn,
): ProperRef {
	return {
		cId,
		source,
		kind: h.kind,
		service: h.service,
		...(h.type !== undefined ? { type: h.type } : {}),
		...(h.tone !== undefined ? { tone: h.tone } : {}),
		...(h.podoben !== undefined ? { podoben: h.podoben } : {}),
		body: h.body,
	};
}
