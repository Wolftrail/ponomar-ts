// Every generator, plus the registry that depends on their output.
import type { GeneratedFile } from "./emit.ts";
import { convertBibleBooks } from "./families/bible.ts";
import { convertDays } from "./families/days.ts";
import { convertLanguagePacks } from "./families/language.ts";
import { convertLives } from "./families/lives.ts";
import { convertRegistry } from "./families/registry.ts";
import { convertRules } from "./families/rules.ts";
import { convertServices } from "./families/services.ts";

const generators: readonly (() => GeneratedFile[])[] = [
	convertRules,
	convertDays,
	convertLanguagePacks,
	convertLives,
	convertBibleBooks,
	convertServices,
];

export function generateAll(): GeneratedFile[] {
	const files = generators.flatMap((generate) => generate());
	return [...files, convertRegistry(files)];
}
