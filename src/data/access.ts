// Lazy access to the generated day and life modules along the language fallback chain.

import { languageChain, languageSlug } from "../core/language.ts";
import { LIFE_CHUNKS } from "./generated/lives/index.ts";
import { LIFE_LOADERS, MENAION_LOADERS, PENTECOSTARION_LOADERS, TRIODION_LOADERS } from "./generated/registry.ts";
import type { DayFile, Life } from "./types.ts";

export type DayCycle = "menaion" | "triodion" | "pentecostarion";

/** "en/" and "en" name the same language; the empty string is the language-neutral root. */
export function normalizeLanguage(language: string): string {
	return language.replace(/^\/+|\/+$/g, "");
}

async function daysOf(cycle: DayCycle, slug: string): Promise<Readonly<Record<string | number, DayFile>> | undefined> {
	switch (cycle) {
		case "menaion":
			return (await MENAION_LOADERS[slug]?.())?.MENAION;
		case "triodion":
			return (await TRIODION_LOADERS[slug]?.())?.TRIODION;
		case "pentecostarion":
			return (await PENTECOSTARION_LOADERS[slug]?.())?.PENTECOSTARION;
	}
}

/**
 * The day file of the most specific language directory that has one: upstream opens a single file, the first
 * found along the chain, and does not merge. `key` is "MM-DD" for the menaion, the file number otherwise.
 */
export async function findDayFile(cycle: DayCycle, language: string, key: string | number): Promise<DayFile | undefined> {
	for (const directory of languageChain(normalizeLanguage(language))) {
		const file = (await daysOf(cycle, languageSlug(directory)))?.[key];
		if (file !== undefined) {
			return file;
		}
	}
	return undefined;
}

/**
 * Every life file for a commemoration along the chain, root first. Upstream parses them in this order and
 * merges them, so a more specific file refines an earlier one.
 */
export async function findLives(cid: string, language: string): Promise<Life[]> {
	const chunk = LIFE_CHUNKS[cid];
	if (chunk === undefined) {
		return [];
	}
	const lives: Life[] = [];
	for (const directory of languageChain(normalizeLanguage(language)).reverse()) {
		const life = (await LIFE_LOADERS[`${chunk}.${languageSlug(directory)}`]?.())?.LIVES[cid];
		if (life !== undefined) {
			lives.push(life);
		}
	}
	return lives;
}
