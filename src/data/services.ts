// Lazy access to the converted service files (prayer texts, Octoechos entries, templates) along the language fallback chain.

import { languageChain, languageSlug } from "../core/language.ts";
import { normalizeLanguage } from "./access.ts";
import { SERVICE_RULES } from "./generated/rules.ts";
import { OCTOECHOS_LOADERS, PRAYER_LOADERS } from "./generated/registry.ts";
import { SERVICE_TEMPLATES } from "./generated/services/templates.ts";
import type { OctoechosEntry, PrayerText, ServiceDirective, ServiceRulePeriod } from "./types.ts";

/**
 * A prayer, command or label text of the first language along the chain that has the file (upstream's
 * `ReadText` opens the first match). `key` is the path under Services/ without the extension, e.g. "CommonPrayers/Amen".
 */
export async function getPrayerText(language: string, key: string): Promise<PrayerText | undefined> {
	for (const directory of languageChain(normalizeLanguage(language))) {
		const prayer = (await PRAYER_LOADERS[languageSlug(directory)]?.())?.PRAYERS[key];
		if (prayer !== undefined) {
			return prayer;
		}
	}
	return undefined;
}

/** The Octoechos entries of a tone and weekday ("tone/Weekday"; tone 0 is tone 8) from the first language along the chain that has them. */
export async function getOctoechosEntries(language: string, key: string): Promise<readonly OctoechosEntry[] | undefined> {
	for (const directory of languageChain(normalizeLanguage(language))) {
		const entries = (await OCTOECHOS_LOADERS[languageSlug(directory)]?.())?.OCTOECHOS[key];
		if (entries !== undefined) {
			return entries;
		}
	}
	return undefined;
}

/** A service template by file name without extension ("Prime", "Kathisma5"); templates are shared by all languages. */
export function getServiceTemplate(name: string): readonly ServiceDirective[] | undefined {
	return SERVICE_TEMPLATES[name];
}

export function getServiceRules(): readonly ServiceRulePeriod[] {
	return SERVICE_RULES;
}
