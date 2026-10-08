// Converts the day files: menaion (MM/DD.xml), triodion, pentecostarion and float, for every language directory.
import type { DaySaint } from "../../../src/data/types.ts";
import { type GeneratedFile, header, literal } from "../emit.ts";
import { attributes, checkExpression, children, compact } from "../schema.ts";
import { LANGUAGES, languageSlug, listFiles, readXml, sourcePath } from "../sources.ts";
import type { XmlElement } from "../xml.ts";

function convertSaint(saint: XmlElement, where: string, allowed: readonly string[]): DaySaint {
	const attrs = attributes(saint, allowed, where, ["CId"]);
	return {
		sid: attrs["SId"] === undefined ? [] : attrs["SId"].split(",").map((id) => id.trim()),
		cid: attrs["CId"]!,
		...compact({
			src: attrs["Src"],
			cmd: checkExpression(attrs["Cmd"], where),
			tone: checkExpression(attrs["Tone"], where),
			type: attrs["Type"],
		}),
	};
}

function convertDay(language: string, logicalPath: string, allowed: readonly string[]): DaySaint[] {
	const where = sourcePath(language, logicalPath);
	return children(readXml(language, logicalPath), ["SAINT"], where).map((saint) => convertSaint(saint, where, allowed));
}

const MENAION_ATTRIBUTES = ["SId", "CId", "Cmd", "Src"];
const MOVABLE_ATTRIBUTES = ["SId", "CId", "Tone", "Cmd", "Type"];

// A leftover draft of 14.xml; upstream only ever opens MM/DD.xml.
const IGNORED = new Set(["cu/xml/01/14_new.xml"]);

function menaionFor(language: string): { sources: string[]; days: Record<string, DaySaint[]> } {
	const days: Record<string, DaySaint[]> = {};
	const sources: string[] = [];
	for (let month = 1; month <= 12; month++) {
		const mm = String(month).padStart(2, "0");
		for (const file of listFiles(language, mm)) {
			if (IGNORED.has(`${language === "" ? "" : `${language}/`}xml/${mm}/${file}`)) {
				continue;
			}
			if (!/^\d\d\.xml$/.test(file)) {
				throw new Error(`${sourcePath(language, `${mm}/${file}`)}: unexpected menaion file name`);
			}
			days[`${mm}-${file.slice(0, 2)}`] = convertDay(language, `${mm}/${file}`, MENAION_ATTRIBUTES);
			sources.push(sourcePath(language, `${mm}/${file}`));
		}
	}
	return { sources, days };
}

function numberedFor(language: string, dir: string, allowed: readonly string[]): { sources: string[]; days: Record<number, DaySaint[]> } {
	const days: Record<number, DaySaint[]> = {};
	const sources: string[] = [];
	for (const file of listFiles(language, dir)) {
		const match = /^(\d+)\.xml$/.exec(file);
		if (!match) {
			throw new Error(`${sourcePath(language, `${dir}/${file}`)}: unexpected file name`);
		}
		days[Number(match[1])] = convertDay(language, `${dir}/${file}`, allowed);
		sources.push(sourcePath(language, `${dir}/${file}`));
	}
	return { sources, days };
}

function floatFor(language: string): { sources: string[]; days: Record<number, unknown> } {
	const days: Record<number, unknown> = {};
	const sources: string[] = [];
	for (const file of listFiles(language, "float")) {
		const match = /^(\d+)\.xml$/.exec(file);
		if (!match) {
			throw new Error(`${sourcePath(language, `float/${file}`)}: unexpected file name`);
		}
		const where = sourcePath(language, `float/${file}`);
		const scriptures: unknown[] = [];
		const saints: unknown[] = [];
		for (const child of children(readXml(language, `float/${file}`), ["SCRIPTURE", "SAINT"], where)) {
			if (child.name === "SCRIPTURE") {
				const attrs = attributes(child, ["Type", "Reading", "Note", "Pericope"], where, ["Type", "Reading"]);
				scriptures.push({ type: attrs["Type"], reading: attrs["Reading"], ...compact({ note: attrs["Note"], pericope: attrs["Pericope"] }) });
			} else {
				const attrs = attributes(child, ["Name", "Id", "Type"], where, ["Name", "Id", "Type"]);
				saints.push({ name: attrs["Name"], id: attrs["Id"], type: attrs["Type"] });
			}
		}
		days[Number(match[1])] = { scriptures, saints };
		sources.push(where);
	}
	return { sources, days };
}

interface Family {
	readonly name: string;
	readonly constant: string;
	readonly type: string;
	readonly build: (language: string) => { sources: string[]; days: Record<string | number, unknown> };
}

const FAMILIES: readonly Family[] = [
	{ name: "menaion", constant: "MENAION", type: "Readonly<Record<string, DayFile>>", build: menaionFor },
	{ name: "triodion", constant: "TRIODION", type: "Readonly<Record<number, DayFile>>", build: (l) => numberedFor(l, "triodion", MOVABLE_ATTRIBUTES) },
	{ name: "pentecostarion", constant: "PENTECOSTARION", type: "Readonly<Record<number, DayFile>>", build: (l) => numberedFor(l, "pentecostarion", MOVABLE_ATTRIBUTES) },
	{ name: "float", constant: "FLOAT", type: "Readonly<Record<number, FloatFile>>", build: floatFor },
];

export function convertDays(): GeneratedFile[] {
	const files: GeneratedFile[] = [];
	for (const family of FAMILIES) {
		for (const language of LANGUAGES) {
			const { sources, days } = family.build(language);
			if (sources.length === 0) {
				continue;
			}
			const imports = family.name === "float" ? "FloatFile" : "DayFile";
			const origin = `${sources[0]} ... ${sources[sources.length - 1]} (${sources.length} files)`;
			files.push({
				path: `src/data/generated/days/${family.name}.${languageSlug(language)}.ts`,
				content: header(origin, `import type { ${imports} } from "../../types.ts";`) + `export const ${family.constant}: ${family.type} = ${literal(days)};\n`,
			});
		}
	}
	return files;
}
