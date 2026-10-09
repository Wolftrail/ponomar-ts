// Ported from Ponomar/Primes.java, ThirdHour.java, SixthHour.java and NinthHour.java createPrimes(), and Ponomar/ServiceInfo.java
// (typiconman/ponomar).
// Differences: the temporary files upstream writes to Services/Var are templates passed in memory, so a file left over
// from an earlier run never appears; the result is a node list, not HTML.

import { evaluateBoolean, type DslContext } from "../core/dsl/index.ts";
import { DEFAULT_CONFIGURATION } from "../data/generated/config.ts";
import { getOctoechosEntries, getServiceRules } from "../data/services.ts";
import type { ServiceDirective } from "../data/types.ts";
import { commemorationReadings } from "./commemoration.ts";
import type { ResolvedDay } from "./day.ts";
import { expandServiceTemplate, type ServiceFiles, type ServiceNode } from "./service.ts";

/** Who serves: upstream's `PS` is 0 for a reader's service and 1 when a priest is present. */
export type ServiceWho = "reader" | "priest";

/** What the hour includes: upstream's `PFlag1`, 0 to 3. */
export type ServiceParts = "independent" | "withoutBeginning" | "withoutEnding" | "withoutBeginningOrEnding";

export interface ServiceOptions {
	readonly who?: ServiceWho;
	readonly parts?: ServiceParts;
}

/** The hours that have a service of their own: the First, Third, Sixth and Ninth, by their names in the data. */
export type HourName = "primes" | "terce" | "sexte" | "none";

const PARTS_FLAG: Readonly<Record<ServiceParts, number>> = { independent: 0, withoutBeginning: 1, withoutEnding: 2, withoutBeginningOrEnding: 3 };

/** The values of the template flags that upstream stores in the day information. */
export interface ServiceFlags {
	/** 0 reader, 1 priest. */
	readonly PS: number;
	/** 0 independent, 1 without the beginning, 2 without the ending, 3 without either. */
	readonly PFlag1?: number;
	/** 0 normal, 1 Lenten without Kathisma, 2 Lenten with Kathisma. */
	readonly PFlag2?: number;
	/** Sixth Hour only: 1 when the day appoints a prophecy to read. */
	readonly PFlag3?: number;
	/** Royal Hours only: 0 Nativity, 1 Theophany, 2 Good Friday. */
	readonly PFlag?: number;
}

export interface ComposedService {
	/**
	 * The type the service rules give the hour: "Normal", "Easter", "Lenten", "Paschal" or "None" (no hour is served).
	 * Undefined on the days the rules say nothing about (Ascension and the week after Pentecost), where upstream fails.
	 */
	readonly type: string | undefined;
	readonly flags: ServiceFlags;
	readonly nodes: readonly ServiceNode[];
}

interface HourSpec {
	/** The element of the service rules. */
	readonly rules: "prime" | "terce" | "sexte" | "none";
	readonly template: string;
	/** The scratch files upstream writes for this hour. */
	readonly troparion: string;
	readonly kontakion: string;
	readonly kathisma: string;
	/** Who sings the kontakion. */
	readonly kontakionWho: string;
}

const HOURS: Readonly<Record<HourName, HourSpec>> = {
	primes: { rules: "prime", template: "Prime", troparion: "Var/PTrop2", kontakion: "Var/PKont1", kathisma: "Var/PKath", kontakionWho: "" },
	terce: { rules: "terce", template: "ThirdHour", troparion: "Var/PTrop32", kontakion: "Var/PKont3", kathisma: "Var/PKath3", kontakionWho: "" },
	sexte: { rules: "sexte", template: "SixthHour", troparion: "Var/PTrop62", kontakion: "Var/PKont6", kathisma: "Var/PKath6", kontakionWho: "SR" },
	none: { rules: "none", template: "NinthHour", troparion: "Var/PTrop92", kontakion: "Var/PKont9", kathisma: "Var/PKath9", kontakionWho: "" },
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The selector defaults of ponomar.config, `Priest,Independent` unless changed. */
function defaultOptions(): Required<ServiceOptions> {
	const [who, parts] = (DEFAULT_CONFIGURATION["Primes"] ?? "Priest,Independent").split(",");
	return {
		who: who === "Reader" ? "reader" : "priest",
		parts: parts === "W.Beginning" ? "withoutBeginning" : parts === "W.Ending" ? "withoutEnding" : parts === "Independent" ? "independent" : "withoutBeginningOrEnding",
	};
}

/** The attributes of the service rules for an hour that apply under `context`, later rules overriding earlier ones. */
function ruleAttributes(hour: HourSpec["rules"], context: DslContext): { type?: string; lentenK?: string } {
	const result: { type?: string; lentenK?: string } = {};
	for (const period of getServiceRules()) {
		if (period.cmd !== undefined && !evaluateBoolean(period.cmd, context)) {
			continue;
		}
		for (const entry of period.entries) {
			if (entry.hour === hour && (entry.cmd === undefined || evaluateBoolean(entry.cmd, context))) {
				result.type = entry.type;
				if (entry.lentenK !== undefined) {
					result.lentenK = entry.lentenK;
				}
			}
		}
	}
	return result;
}

const hymn = (what: string, who: string): ServiceDirective => ({ directive: "create", what, who, header: "1", redFirst: "1", newLine: "1" });

/** The prophecy that the Triodion appoints for the Sixth Hour: the reading of its first commemoration, if any. */
async function sixthHourReading(day: ResolvedDay, language: string, context: DslContext): Promise<string> {
	const first = day.paschal.commemorations[0];
	if (first === undefined) {
		return "";
	}
	return (await commemorationReadings(first.cid, language, "sexte", context))["1"]?.reading ?? "";
}

/** The Sixth Hour's Lenten parts: troparion, prokeimena and stichera of the day from the Triodion, with the prophecy. */
function prophecyFiles(nday: number, reading: string): Record<string, readonly ServiceDirective[]> {
	const id = -nday < 10 ? `0${-nday}` : String(-nday);
	const proper = (what: string, who: string, flags: { header?: boolean; redFirst?: boolean; newLine?: boolean } = {}): ServiceDirective => ({
		directive: "getId",
		type: "T",
		id,
		what: `/SEXTE/${what}`,
		who,
		redFirst: flags.redFirst ? "1" : "0",
		newLine: flags.newLine ? "1" : "0",
		header: flags.header ? "1" : "0",
	});
	const both = { redFirst: true, newLine: true };
	return {
		"Var/TP6R": [proper("TROPARION/1", "R", { ...both, header: true })],
		"Var/TP6C": [proper("TROPARION/1", "C", both)],
		"Var/PROK61R": [proper("PROKEIMENON/1a", "R", { ...both, header: true }), proper("PROKEIMENON/1b", "R")],
		"Var/PROK61C": [proper("PROKEIMENON/1a", "C", both), proper("PROKEIMENON/1b", "C")],
		"Var/STYX61R": [proper("STICHOS/1", "R", both)],
		"Var/STYX61C": [proper("STICHOS/1", "C", both)],
		"Var/PROK61a": [proper("PROKEIMENON/1a", "R", both)],
		"Var/PROK61b": [proper("PROKEIMENON/1b", "C", { newLine: true })],
		"Var/Intro6": [{ directive: "bible", who: "SR", newLine: "1", getReading: reading }],
		"Var/Reading6": [{ directive: "bible", who: "SR", newLine: "1", redFirst: "1", header: "1", verses: reading }],
		"Var/PROK62R": [proper("PROKEIMENON/2a", "R", { ...both, header: true }), proper("PROKEIMENON/2b", "R")],
		"Var/PROK62C": [proper("PROKEIMENON/2a", "C", both), proper("PROKEIMENON/2b", "C")],
		"Var/STYX62R": [proper("STICHOS/2", "R", both)],
		"Var/STYX62C": [proper("STICHOS/2", "C", both)],
		"Var/PROK62a": [proper("PROKEIMENON/2a", "R", both)],
		"Var/PROK62b": [proper("PROKEIMENON/2b", "C", { newLine: true })],
	};
}

/**
 * Composes one of the four hours for a resolved day: the Octoechos troparion and kontakion for the tone and weekday,
 * the Lenten variant with its Kathisma (and, at the Sixth Hour, the prophecy), or the Paschal Hours, according to the
 * service rules.
 */
export async function composeHour(hour: HourName, day: ResolvedDay, language: string, options: ServiceOptions = {}): Promise<ComposedService> {
	const spec = HOURS[hour];
	const { who, parts } = { ...defaultOptions(), ...options };
	const PS = who === "reader" ? 0 : 1;
	const context: DslContext = { ...day.variables, dRank: day.rank, PS };

	let troparion: string | undefined;
	let kontakion: string | undefined;
	const tone = day.tone === 8 ? 0 : day.tone;
	if (tone !== -1) {
		const entries = await getOctoechosEntries(language, `${tone}/${WEEKDAYS[context["dow"]!]}`);
		for (const entry of entries ?? []) {
			if (entry.hour === hour && evaluateBoolean(entry.cmd, context)) {
				troparion = entry.troparion1 ?? troparion;
				kontakion = entry.kontakion1;
			}
		}
	}
	const reading = hour === "sexte" ? await sixthHourReading(day, language, context) : "";

	const rules = ruleAttributes(spec.rules, context);
	const type = rules.type;
	if (type === undefined || type === "None") {
		return { type, flags: { PS }, nodes: [] };
	}
	if (type === "Paschal") {
		return { type, flags: { PS }, nodes: await expandServiceTemplate("PaschalHours", language, context) };
	}

	let PFlag2 = 0;
	let PFlag3 = 0;
	const files: Record<string, readonly ServiceDirective[]> = {};
	if (type === "Lenten") {
		PFlag2 = 1;
		if (rules.lentenK !== undefined) {
			PFlag2 = 2;
			files[spec.kathisma] = [{ directive: "get", file: `Kathisma${rules.lentenK}`, null: "1" }];
		}
		if (hour === "sexte" && reading !== "") {
			PFlag3 = 1;
			Object.assign(files, prophecyFiles(context["nday"]!, reading));
		}
	} else if (troparion !== undefined) {
		// Upstream always writes the second troparion slot with the first troparion; the first slot only exists with a second troparion, which no data gives.
		files[spec.troparion] = [hymn(`TROPARION/${troparion}`, "")];
	}
	if (kontakion !== undefined) {
		files[spec.kontakion] = [hymn(`KONTAKION/${kontakion}`, spec.kontakionWho)];
	}

	const flags: ServiceFlags = { PS, PFlag1: PARTS_FLAG[parts], PFlag2, ...(hour === "sexte" ? { PFlag3 } : {}) };
	const nodes = await expandServiceTemplate(spec.template, language, { ...context, PFlag1: flags.PFlag1!, PFlag2, ...(hour === "sexte" ? { PFlag3 } : {}) }, files as ServiceFiles);
	return { type, flags, nodes };
}

/** The First Hour. */
export function composePrimes(day: ResolvedDay, language: string, options: ServiceOptions = {}): Promise<ComposedService> {
	return composeHour("primes", day, language, options);
}

/** The Third Hour. */
export function composeThirdHour(day: ResolvedDay, language: string, options: ServiceOptions = {}): Promise<ComposedService> {
	return composeHour("terce", day, language, options);
}

/** The Sixth Hour. */
export function composeSixthHour(day: ResolvedDay, language: string, options: ServiceOptions = {}): Promise<ComposedService> {
	return composeHour("sexte", day, language, options);
}

/** The Ninth Hour. */
export function composeNinthHour(day: ResolvedDay, language: string, options: ServiceOptions = {}): Promise<ComposedService> {
	return composeHour("none", day, language, options);
}

/**
 * The Royal Hours, served on Good Friday and on the eves of Nativity and Theophany (Fridays, or any day but a weekend when the
 * eve falls on one). A priest is always taken to be present. `type` is "RoyalHours" on those days and "None" otherwise.
 */
export async function composeRoyalHours(day: ResolvedDay, language: string): Promise<ComposedService> {
	const { nday, doy, dow } = day.variables as { nday: number; doy: number; dow: number };
	const weekday = dow !== 6 && dow !== 0;
	const theophanyEve = (doy === 4 && weekday) || (doy === 2 && dow === 5) || (doy === 3 && dow === 5);
	const nativityEve = (doy === 357 && weekday) || (doy === 356 && dow === 5) || (doy === 355 && dow === 5);
	if (!(nday === -2 || theophanyEve || nativityEve)) {
		return { type: "None", flags: { PS: 1 }, nodes: [] };
	}
	const PFlag = theophanyEve ? 1 : nday === -2 ? 2 : 0;
	const nodes = await expandServiceTemplate("RoyalHours", language, { ...day.variables, dRank: day.rank, PS: 1, PFlag });
	return { type: "RoyalHours", flags: { PS: 1, PFlag }, nodes };
}
