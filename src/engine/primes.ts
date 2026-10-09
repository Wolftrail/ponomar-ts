// Ported from Ponomar/Primes.java createPrimes() and Ponomar/ServiceInfo.java (typiconman/ponomar).
// Differences: the temporary files upstream writes to Services/Var are templates passed in memory, so a file left over
// from an earlier run never appears; the result is a node list, not HTML.

import { evaluateBoolean, type DslContext } from "../core/dsl/index.ts";
import { DEFAULT_CONFIGURATION } from "../data/generated/config.ts";
import { getOctoechosEntries, getServiceRules } from "../data/services.ts";
import type { ServiceDirective } from "../data/types.ts";
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

const PARTS_FLAG: Readonly<Record<ServiceParts, number>> = { independent: 0, withoutBeginning: 1, withoutEnding: 2, withoutBeginningOrEnding: 3 };

/** The values of the template flags that upstream stores in the day information. */
export interface ServiceFlags {
	/** 0 reader, 1 priest. */
	readonly PS: number;
	/** 0 independent, 1 without the beginning, 2 without the ending, 3 without either. */
	readonly PFlag1?: number;
	/** 0 normal, 1 Lenten without Kathisma, 2 Lenten with Kathisma. */
	readonly PFlag2?: number;
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
function ruleAttributes(hour: "prime", context: DslContext): { type?: string; lentenK?: string } {
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

const properHymn = (what: string): ServiceDirective => ({ directive: "create", what, who: "", header: "1", redFirst: "1", newLine: "1" });

/**
 * Composes the First Hour for a resolved day: the Octoechos troparion and kontakion for the tone and weekday, the
 * Lenten variant with its Kathisma, or the Paschal Hours, according to the service rules.
 */
export async function composePrimes(day: ResolvedDay, language: string, options: ServiceOptions = {}): Promise<ComposedService> {
	const { who, parts } = { ...defaultOptions(), ...options };
	const PS = who === "reader" ? 0 : 1;
	const context: DslContext = { ...day.variables, dRank: day.rank, PS };

	let troparion: string | undefined;
	let kontakion: string | undefined;
	const tone = day.tone === 8 ? 0 : day.tone;
	if (tone !== -1) {
		const entries = await getOctoechosEntries(language, `${tone}/${WEEKDAYS[context["dow"]!]}`);
		for (const entry of entries ?? []) {
			if (entry.hour === "primes" && evaluateBoolean(entry.cmd, context)) {
				troparion = entry.troparion1 ?? troparion;
				kontakion = entry.kontakion1;
			}
		}
	}

	const rules = ruleAttributes("prime", context);
	const lentenK = rules.lentenK;
	const type = rules.type;
	if (type === undefined) {
		return { type, flags: { PS }, nodes: [] };
	}
	if (type === "None") {
		return { type, flags: { PS }, nodes: [] };
	}
	if (type === "Paschal") {
		return { type, flags: { PS }, nodes: await expandServiceTemplate("PaschalHours", language, context) };
	}

	let PFlag2 = 0;
	const files: Record<string, readonly ServiceDirective[]> = {};
	if (type === "Lenten") {
		PFlag2 = 1;
		if (lentenK !== undefined) {
			PFlag2 = 2;
			files["Var/PKath"] = [{ directive: "get", file: `Kathisma${lentenK}`, null: "1" }];
		}
	} else if (troparion !== undefined) {
		// Upstream always writes the second troparion slot with the first troparion; the first slot only exists with a second troparion, which no data gives.
		files["Var/PTrop2"] = [properHymn(`TROPARION/${troparion}`)];
	}
	if (kontakion !== undefined) {
		files["Var/PKont1"] = [properHymn(`KONTAKION/${kontakion}`)];
	}

	const flags: ServiceFlags = { PS, PFlag1: PARTS_FLAG[parts], PFlag2 };
	const nodes = await expandServiceTemplate("Prime", language, { ...context, PFlag1: flags.PFlag1!, PFlag2 }, files as ServiceFiles);
	return { type, flags, nodes };
}
