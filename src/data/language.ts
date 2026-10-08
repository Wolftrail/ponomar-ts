// Lazy access to the generated language packs along the language fallback chain.

import { languageChain, languageSlug } from "../core/language.ts";
import { normalizeLanguage } from "./access.ts";
import { LANGUAGE_PACK_LOADERS } from "./generated/registry.ts";
import type { LanguagePackData, Podoben, TimesLabel } from "./types.ts";

type PackField = keyof LanguagePackData;

/**
 * The first language directory along the chain that defines `field`; upstream looks each Commands file up
 * on its own, so a language can define its phrases but inherit its Times labels.
 */
async function lookup<K extends PackField>(field: K, language: string): Promise<NonNullable<LanguagePackData[K]> | undefined> {
	for (const directory of languageChain(normalizeLanguage(language))) {
		const value = (await LANGUAGE_PACK_LOADERS[languageSlug(directory)]?.())?.LANGUAGE_PACK[field];
		if (value !== undefined) {
			return value as NonNullable<LanguagePackData[K]>;
		}
	}
	return undefined;
}

export async function getPhrases(language: string): Promise<Readonly<Record<string, string>>> {
	return (await lookup("phrases", language)) ?? {};
}

/** A phrase of the language pack, or undefined if the language defines none. */
export async function getPhrase(language: string, key: string): Promise<string | undefined> {
	return (await getPhrases(language))[key];
}

/** A phrase holding a list: upstream's `obtainValues` splits on "/,". */
export async function getPhraseList(language: string, key: string): Promise<string[] | undefined> {
	return (await getPhrase(language, key))?.split("/,");
}

export async function getTimesLabels(language: string): Promise<readonly TimesLabel[]> {
	return (await lookup("times", language)) ?? [];
}

export async function getPodobni(language: string): Promise<readonly Podoben[]> {
	return (await lookup("podobni", language)) ?? [];
}

/** The `RuleBasedNumbers.xml` phrase table of the first language along the chain that has one. */
export async function getNumberRules(language: string): Promise<Readonly<Record<string, string>> | undefined> {
	return lookup("numberRules", language);
}
