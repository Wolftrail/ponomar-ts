// Converts the per-language Commands files (LanguagePacks, Times, Podobni, RuleBasedNumbers) and ponomar.config.
import type { LanguagePackData, Podoben, TimesLabel } from "../../../src/data/types.ts";
import { type GeneratedFile, header, literal } from "../emit.ts";
import { attributes, checkExpression, children, compact } from "../schema.ts";
import { LANGUAGES, languageSlug, listFiles, readXml, sourcePath } from "../sources.ts";

function phraseTable(language: string, file: string, allowed: readonly string[]): Record<string, string> {
	const where = sourcePath(language, `Commands/${file}`);
	const table: Record<string, string> = {};
	for (const phrase of children(readXml(language, `Commands/${file}`), ["PHRASE"], where)) {
		const attrs = attributes(phrase, allowed, where, ["Key", "Value"]);
		const key = attrs["Key"]!;
		// Upstream keeps the last definition; repeats are only tolerated when they agree.
		if (key in table && table[key] !== attrs["Value"]) {
			throw new Error(`${where}: conflicting definitions of phrase "${key}"`);
		}
		table[key] = attrs["Value"]!;
	}
	return table;
}

function times(language: string): TimesLabel[] {
	const where = sourcePath(language, "Commands/Times.xml");
	// cu/xml/Commands/Times.xml has a stray backtick between entries.
	return children(readXml(language, "Commands/Times.xml"), ["TIMES"], where, ["`"]).map((entry) => {
		const attrs = attributes(entry, ["Value", "Cmd"], where, ["Value"]);
		return { value: attrs["Value"]!, ...compact({ cmd: checkExpression(attrs["Cmd"], where) }) };
	});
}

function podobni(language: string): Podoben[] {
	const where = sourcePath(language, "Commands/Podobni.xml");
	return children(readXml(language, "Commands/Podobni.xml"), ["PODOBEN"], where).map((entry) => {
		const attrs = attributes(entry, ["Tone", "Case", "Intro", "Comment"], where, ["Tone", "Case", "Intro"]);
		return { tone: attrs["Tone"]!, case: attrs["Case"]!, intro: attrs["Intro"]!, comment: attrs["Comment"] ?? "" };
	});
}

function convertConfiguration(): GeneratedFile {
	const where = sourcePath("", "ponomar.config");
	const [defaults, ...rest] = children(readXml("", "ponomar.config"), ["DEFAULT"], where);
	if (defaults === undefined || rest.length > 0) {
		throw new Error(`${where}: expected exactly one <DEFAULT>`);
	}
	return {
		path: "src/data/generated/config.ts",
		content: header(where) + `export const DEFAULT_CONFIGURATION: Readonly<Record<string, string>> = ${literal(defaults.attributes)};\n`,
	};
}

export function convertLanguagePacks(): GeneratedFile[] {
	const files: GeneratedFile[] = [convertConfiguration()];
	for (const language of LANGUAGES) {
		if (!listFiles(language, "Commands").includes("LanguagePacks.xml")) {
			continue;
		}
		const has = (name: string): boolean => listFiles(language, "Commands").includes(name);
		const data: LanguagePackData = {
			phrases: phraseTable(language, "LanguagePacks.xml", ["Key", "Value", "Comment", "Comments", "Note"]),
			...(has("Times.xml") ? { times: times(language) } : {}),
			...(has("Podobni.xml") ? { podobni: podobni(language) } : {}),
			...(has("RuleBasedNumbers.xml") ? { numberRules: phraseTable(language, "RuleBasedNumbers.xml", ["Key", "Value"]) } : {}),
		};
		const origin = ["LanguagePacks", "Times", "Podobni", "RuleBasedNumbers"].filter((n) => has(`${n}.xml`)).map((n) => sourcePath(language, `Commands/${n}.xml`));
		files.push({
			path: `src/data/generated/language/${languageSlug(language)}.ts`,
			content: header(origin.join(", "), 'import type { LanguagePackData } from "../../types.ts";') + `export const LANGUAGE_PACK: LanguagePackData = ${literal(data)};\n`,
		});
	}
	return files;
}
