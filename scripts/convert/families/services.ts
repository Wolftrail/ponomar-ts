// Converts service templates, per-language prayer texts and the Octoechos tables under Services/.
// Not converted on purpose: Services/Var (scratch files the hour classes write at runtime and read back),
// Services/menaion (read only by the unported search database; no day file names its ids) and Commemorations/ (no reader upstream).
import type { OctoechosEntry, PrayerText, ServiceDirective } from "../../../src/data/types.ts";
import { type GeneratedFile, header, literal } from "../emit.ts";
import { attributes, checkExpression, children, compact } from "../schema.ts";
import { LANGUAGES, languageSlug, listFiles, readXml, sourcePath } from "../sources.ts";
import type { XmlElement } from "../xml.ts";

function directive(element: XmlElement, where: string): ServiceDirective {
	switch (element.name) {
		case "TITLE": {
			const a = attributes(element, ["Value", "Source", "Header", "Comment"], where, ["Value"]);
			return { directive: "title", value: a["Value"]!, ...compact({ header: a["Header"], source: a["Source"], comment: a["Comment"] }) };
		}
		case "SUBTITLE":
			return { directive: "subtitle", value: attributes(element, ["Value"], where, ["Value"])["Value"]! };
		case "GET": {
			const a = attributes(element, ["File", "Cmd", "Null"], where, ["File"]);
			return { directive: "get", file: a["File"]!, ...compact({ cmd: checkExpression(a["Cmd"], where), null: a["Null"] }) };
		}
		case "CREATE": {
			const a = attributes(element, ["What", "Who", "RedFirst", "NewLine", "Times", "Command", "Cmd", "Header", "CommandB"], where, ["What", "Who"]);
			return {
				directive: "create",
				what: a["What"]!,
				who: a["Who"]!,
				...compact({ redFirst: a["RedFirst"], newLine: a["NewLine"], times: a["Times"], command: a["Command"], commandB: a["CommandB"], header: a["Header"], cmd: checkExpression(a["Cmd"], where) }),
			};
		}
		case "BIBLE": {
			const a = attributes(element, ["Verses", "Who", "RedFirst", "NewLine", "Header", "TwoStars", "getReading", "Cmd"], where, ["Who", "NewLine"]);
			return {
				directive: "bible",
				who: a["Who"]!,
				newLine: a["NewLine"]!,
				...compact({ verses: a["Verses"], redFirst: a["RedFirst"], header: a["Header"], twoStars: a["TwoStars"], getReading: a["getReading"], cmd: checkExpression(a["Cmd"], where) }),
			};
		}
		case "GETID": {
			const a = attributes(element, ["Type", "Id", "What", "Who", "RedFirst", "NewLine", "Header", "Cmd", "Times"], where, ["Type", "Id", "What", "Who", "RedFirst", "NewLine"]);
			return {
				directive: "getId",
				type: a["Type"]!,
				id: a["Id"]!,
				what: a["What"]!,
				who: a["Who"]!,
				redFirst: a["RedFirst"]!,
				newLine: a["NewLine"]!,
				...compact({ header: a["Header"], times: a["Times"], cmd: checkExpression(a["Cmd"], where) }),
			};
		}
		default:
			throw new Error(`${where}: unexpected directive <${element.name}>`);
	}
}

function convertTemplates(): GeneratedFile {
	const templates: Record<string, ServiceDirective[]> = {};
	const sources: string[] = [];
	for (const file of listFiles("", "Services")) {
		const where = sourcePath("", `Services/${file}`);
		const root = readXml("", `Services/${file}`);
		if (root.name !== "SERVICES") {
			throw new Error(`${where}: root element is <${root.name}>`);
		}
		templates[file.replace(/\.xml$/, "")] = children(root, ["TITLE", "SUBTITLE", "GET", "CREATE", "BIBLE", "GETID"], where).map((el) => directive(el, where));
		sources.push(where);
	}
	return {
		path: "src/data/generated/services/templates.ts",
		content:
			header(`${sources.length} files in ${sources[0]!.replace(/[^/]*$/, "")}`, 'import type { ServiceDirective } from "../../types.ts";') +
			`export const SERVICE_TEMPLATES: Readonly<Record<string, readonly ServiceDirective[]>> = ${literal(templates)};\n`,
	};
}

const PRAYER_DIRECTORIES = ["CommonPrayers", "CommonPrayers/KONTAKION", "CommonPrayers/TROPARION", "Command", "Header", "Text"];

function prayer(language: string, logicalPath: string): PrayerText {
	const where = sourcePath(language, logicalPath);
	const root = readXml(language, logicalPath);
	if (!["COMMONPRAYER", "KONTAKION", "TROPARION"].includes(root.name)) {
		throw new Error(`${where}: root element is <${root.name}>`);
	}
	attributes(root, [], where);
	const parts = children(root, ["HEADER", "TEXT"], where);
	const headers = parts.filter((p) => p.name === "HEADER");
	const texts = parts.filter((p) => p.name === "TEXT");
	if (texts.length !== 1 || headers.length > 1) {
		throw new Error(`${where}: expected one <TEXT> and at most one <HEADER>`);
	}
	const text = attributes(texts[0]!, ["Value"], where, ["Value"])["Value"]!;
	const head = headers[0] === undefined ? undefined : attributes(headers[0], ["Value"], where, ["Value"])["Value"];
	return { ...compact({ header: head }), text };
}

function convertPrayers(): GeneratedFile[] {
	const files: GeneratedFile[] = [];
	for (const language of LANGUAGES) {
		const table: Record<string, PrayerText> = {};
		const sources: string[] = [];
		for (const dir of PRAYER_DIRECTORIES) {
			for (const file of listFiles(language, `Services/${dir}`)) {
				table[`${dir}/${file.replace(/\.xml$/, "")}`] = prayer(language, `Services/${dir}/${file}`);
				sources.push(sourcePath(language, `Services/${dir}/${file}`));
			}
		}
		if (sources.length > 0) {
			files.push({
				path: `src/data/generated/services/prayers.${languageSlug(language)}.ts`,
				content:
					header(`${sources.length} files under ${sources[0]!.replace(/Services\/.*$/, "Services/")}`, 'import type { PrayerText } from "../../types.ts";') +
					`/** Keyed by directory and file name under Services/, e.g. "CommonPrayers/NiceneCreed". */\nexport const PRAYERS: Readonly<Record<string, PrayerText>> = ${literal(table)};\n`,
			});
		}
	}
	return files;
}

const HOURS: Readonly<Record<string, OctoechosEntry["hour"]>> = { PRIMES: "primes", TERCE: "terce", SEXTE: "sexte", NONE: "none" };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function convertOctoechos(): GeneratedFile[] {
	const files: GeneratedFile[] = [];
	for (const language of LANGUAGES) {
		const table: Record<string, OctoechosEntry[]> = {};
		let sources = 0;
		let firstSource = "";
		for (let tone = 0; tone <= 7; tone++) {
			for (const day of DAYS) {
				const logicalPath = `Services/Octoecheos/Tone ${tone}/${day}.xml`;
				if (!listFiles(language, `Services/Octoecheos/Tone ${tone}`).includes(`${day}.xml`)) {
					continue;
				}
				const where = sourcePath(language, logicalPath);
				const root = readXml(language, logicalPath);
				if (root.name !== "TONE") {
					throw new Error(`${where}: root element is <${root.name}>`);
				}
				table[`${tone}/${day}`] = children(root, Object.keys(HOURS), where).map((entry) => {
					const a = attributes(entry, ["TROPARION1", "Type", "KONTAKION1", "Cmd"], where, ["Type", "KONTAKION1", "Cmd"]);
					return {
						hour: HOURS[entry.name]!,
						type: a["Type"]!,
						...compact({ troparion1: a["TROPARION1"] }),
						kontakion1: a["KONTAKION1"]!,
						cmd: checkExpression(a["Cmd"], where)!,
					};
				});
				firstSource ||= where;
				sources++;
			}
		}
		if (sources > 0) {
			files.push({
				path: `src/data/generated/services/octoechos.${languageSlug(language)}.ts`,
				content:
					header(`${sources} files, first ${firstSource}`, 'import type { OctoechosEntry } from "../../types.ts";') +
					`/** Keyed "tone/Weekday"; tone 0 is tone 8. */\nexport const OCTOECHOS: Readonly<Record<string, readonly OctoechosEntry[]>> = ${literal(table)};\n`,
			});
		}
	}
	return files;
}

export function convertServices(): GeneratedFile[] {
	return [convertTemplates(), ...convertPrayers(), ...convertOctoechos()];
}
