// Regenerates src/data/generated from the vendored Ponomar XML. `--check` fails if the output has drifted.
import { findDrift, type GeneratedFile, writeFiles } from "./emit.ts";
import { convertBibleBooks } from "./families/bible.ts";
import { convertDays } from "./families/days.ts";
import { convertLanguagePacks } from "./families/language.ts";
import { convertLives } from "./families/lives.ts";
import { convertRules } from "./families/rules.ts";
import { convertServices } from "./families/services.ts";

const generators: readonly (() => GeneratedFile[])[] = [convertRules, convertDays, convertLanguagePacks, convertLives, convertBibleBooks, convertServices];
const files = generators.flatMap((generate) => generate());

if (process.argv.includes("--check")) {
	const drift = findDrift(files);
	if (drift.length > 0) {
		console.error(`generated data is out of date (${drift.length} files):\n${drift.map((p) => `  ${p}`).join("\n")}`);
		process.exit(1);
	}
	console.log(`generated data is up to date (${files.length} files)`);
} else {
	writeFiles(files);
	console.log(`wrote ${files.length} files`);
}
