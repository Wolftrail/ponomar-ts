// Index of the vendored Ponomar data and the upstream language fallback chain.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeXml, parseXml, type XmlElement } from "./xml.ts";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
export const languagesRoot = join(repoRoot, "vendor", "ponomar", "Ponomar", "languages");

/** Language directories that hold an `xml/` tree. The empty string is the language-neutral root. */
export const LANGUAGES = ["", "cu", "cu/ru", "el", "el/mono", "en", "fr", "zh", "zh/Hans", "zh/Hant"] as const;
export type Language = (typeof LANGUAGES)[number];

export { languageChain, languageSlug } from "../../src/core/language.ts";

export function xmlDir(language: string): string {
	return language === "" ? join(languagesRoot, "xml") : join(languagesRoot, ...language.split("/"), "xml");
}

/** Files directly in `logicalDir` (relative to a language's `xml/`), as logical sub-paths, for one language directory only. */
export function listFiles(language: string, logicalDir: string, extension = ".xml"): string[] {
	const dir = join(xmlDir(language), ...logicalDir.split("/").filter(Boolean));
	let names: string[];
	try {
		names = readdirSync(dir);
	} catch {
		return [];
	}
	return names.filter((name) => name.endsWith(extension) && statSync(join(dir, name)).isFile()).sort();
}

export function readXml(language: string, logicalPath: string): XmlElement {
	return parseXml(decodeXml(readFileSync(join(xmlDir(language), ...logicalPath.split("/")))));
}

/** Path of a source file relative to the repository, with forward slashes, for citation in generated headers. */
export function sourcePath(language: string, logicalPath: string): string {
	return relative(repoRoot, join(xmlDir(language), ...logicalPath.split("/"))).split(sep).join("/");
}
