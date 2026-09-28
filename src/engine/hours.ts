// Hour service wrappers over `composeService`.
//
// Ported from Ponomar/{NinthHour,SixthHour,ThirdHour,Prime}.java — the
// "which template do I compose for this Little Hour today, and with what
// service flags?" glue. Each upstream class is essentially a switch on the
// merged `HourSelection.type` from `ServiceInfo.java` plus a couple of
// per-service defaults; that's what this module encodes.
//
// The mapping (see NinthHour.xml / etc. headers for canonical semantics):
//
//   * `type === "None"`   → no service today (Royal Hours are served instead);
//                           result is `{ service: null, templateName: null }`.
//   * `type === "Paschal"`→ compose `PaschalHours.xml` (invariant across all
//                           four hours during Bright Week).
//   * `type === "Easter"` → normal template composition; the `Easter`
//                           moniker is upstream's tag for the Pentecostarion
//                           period after Bright Week.
//   * `type === "Normal"` → normal template composition with `PFlag2 = 0`.
//   * `type === "Lenten"` → normal template composition with `PFlag2 = 1`
//                           (Lenten variant with troparia + prostrations).
//
// `PS` / `PFlag1` / `PFlag2` may be overridden by the caller. `PFlag2` is
// auto-derived from `HourSelection.type` when the caller doesn't set it.

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import type { ComposedService } from "./compose.ts";
import { composeService } from "./compose.ts";
import type { DayContext } from "./day.ts";
import { getServices } from "./services.ts";
import type { HourSelection, ServicesResult } from "./services.ts";

export type HourName = "prime" | "third" | "sixth" | "ninth";

export interface GetHourServiceOptions {
	readonly PS?: number;
	readonly PFlag1?: number;
	readonly PFlag2?: number;
	readonly PFlag3?: number;
}

export interface HourServiceResult {
	readonly context: DayContext;
	readonly hour: HourName;
	readonly selection: HourSelection | undefined;
	readonly templateName: string | null;
	readonly service: ComposedService | null;
	readonly PS: number;
	readonly PFlag1: number;
	readonly PFlag2: number;
	readonly PFlag3: number;
}

const HOUR_TEMPLATE: Readonly<Record<HourName, string>> = {
	prime: "Prime",
	third: "ThirdHour",
	sixth: "SixthHour",
	ninth: "NinthHour",
};

export function getHourService(
	gregorian: CalendarDate,
	hour: HourName,
	options: GetHourServiceOptions = {},
): HourServiceResult {
	const services = getServices(gregorian);
	const selection = pickSelection(services, hour);
	const PS = options.PS ?? 0;
	const PFlag1 = options.PFlag1 ?? 0;
	const PFlag3 = options.PFlag3 ?? 0;

	if (selection === undefined || selection.type === "None") {
		return {
			context: services.context,
			hour,
			selection,
			templateName: null,
			service: null,
			PS,
			PFlag1,
			PFlag2: options.PFlag2 ?? 0,
			PFlag3,
		};
	}

	const derivedPFlag2 = selection.type === "Lenten" ? 1 : 0;
	const PFlag2 = options.PFlag2 ?? derivedPFlag2;

	const templateName =
		selection.type === "Paschal" ? "PaschalHours" : HOUR_TEMPLATE[hour];

	const service = composeService(gregorian, templateName, {
		PS,
		PFlag1,
		PFlag2,
		PFlag3,
	});

	return {
		context: services.context,
		hour,
		selection,
		templateName,
		service,
		PS,
		PFlag1,
		PFlag2,
		PFlag3,
	};
}

function pickSelection(
	services: ServicesResult,
	hour: HourName,
): HourSelection | undefined {
	switch (hour) {
		case "prime":
			return services.prime;
		case "third":
			return services.terce;
		case "sixth":
			return services.sexte;
		case "ninth":
			return services.none;
	}
}
