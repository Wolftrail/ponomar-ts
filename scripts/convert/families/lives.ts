// Converts lives/<cid>.xml for every language directory into month chunks.
// Upstream (Commemoration1.readCommemoration) merges the root file with each language file along the chain at
// read time, so each directory's file is converted on its own and never merged here.
import type {
	Life,
	LifeBiography,
	LifeChunk,
	LifeHymn,
	LifeItem,
	LifeName,
	LifeScripture,
	LifeSection,
	LifeSectionName,
	LifeService,
	LifeVerse,
} from "../../../src/data/types.ts";
import { type GeneratedFile, header, literal } from "../emit.ts";
import { attributes, checkExpression, children, compact } from "../schema.ts";
import { LANGUAGES, languageSlug, listFiles, readXml, sourcePath } from "../sources.ts";
import { childElements, type XmlElement } from "../xml.ts";

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

// Upstream opens lives/<CId>.xml only, so this misnamed copy (a typo for 050307.xml) is never read.
const IGNORED = new Set(["fr/xml/lives/050307;.xml"]);

/** Text with inline `<br/>` and `<p>` kept as HTML; any other child element is an error. */
function inlineText(element: XmlElement, where: string): string {
	let out = "";
	for (const child of element.children) {
		if (typeof child === "string") {
			out += child;
		} else if (child.name === "br" && child.children.length === 0) {
			out += "<br/>";
		} else if (child.name === "p") {
			out += `<p>${inlineText(child, where)}</p>`;
		} else {
			throw new Error(`${where}: <${element.name}> has unexpected child <${child.name}>`);
		}
	}
	return out.trim();
}

const HYMN_ATTRIBUTES = ["Type", "Tone", "Podoben", "Header", "Author", "Comment", "Translator"];

function hymn(element: XmlElement, where: string): LifeHymn {
	const attrs = attributes(element, HYMN_ATTRIBUTES, where);
	return {
		kind: element.name === "TROPARION" ? "troparion" : "kontakion",
		text: inlineText(element, where),
		...compact({
			type: attrs["Type"],
			tone: attrs["Tone"],
			podoben: attrs["Podoben"],
			header: attrs["Header"],
			author: attrs["Author"],
			comment: attrs["Comment"],
			translator: attrs["Translator"],
		}),
	};
}

function scripture(element: XmlElement, where: string): LifeScripture {
	const attrs = attributes(element, ["Type", "Pericope", "Reading", "Cmd", "Note", "EffWeek"], where, ["Type", "Reading"]);
	return {
		kind: "scripture",
		type: attrs["Type"]!,
		reading: attrs["Reading"]!,
		...compact({ pericope: attrs["Pericope"], cmd: checkExpression(attrs["Cmd"], where), note: attrs["Note"], effWeek: attrs["EffWeek"] }),
	};
}

const VERSE_KINDS: Readonly<Record<string, { kind: LifeVerse["kind"]; attributes: readonly string[] }>> = {
	IDIOMEL: { kind: "idiomel", attributes: ["Type", "Tone", "Header", "Author"] },
	PROKEIMENON: { kind: "prokeimenon", attributes: ["Type", "Tone", "Header"] },
	VERSE: { kind: "verse", attributes: ["Type"] },
	STICHOS: { kind: "stichos", attributes: ["Type"] },
};

function verse(element: XmlElement, where: string): LifeVerse {
	const spec = VERSE_KINDS[element.name]!;
	const attrs = attributes(element, spec.attributes, where);
	return {
		kind: spec.kind,
		text: inlineText(element, where),
		...compact({ type: attrs["Type"], tone: attrs["Tone"], header: attrs["Header"], author: attrs["Author"] }),
	};
}

const SECTIONS: Readonly<Record<string, { section: LifeSectionName; items: readonly string[] }>> = {
	LITURGY: { section: "liturgy", items: ["KONTAKION", "SCRIPTURE", "TROPARION"] },
	MATINS: { section: "matins", items: ["SCRIPTURE"] },
	NONE: { section: "none", items: ["SCRIPTURE"] },
	PRIMES: { section: "primes", items: ["SCRIPTURE"] },
	TERCE: { section: "terce", items: ["SCRIPTURE"] },
	SEXTE: { section: "sexte", items: ["PROKEIMENON", "SCRIPTURE", "STICHOS", "TROPARION"] },
	VESPERS: { section: "vespers", items: ["SCRIPTURE"] },
	ROYALHOURS: { section: "royalhours", items: ["IDIOMEL", "PROKEIMENON", "VERSE"] },
};

function item(element: XmlElement, where: string): LifeItem {
	if (element.name === "SCRIPTURE") {
		return scripture(element, where);
	}
	if (element.name === "TROPARION" || element.name === "KONTAKION") {
		return hymn(element, where);
	}
	return verse(element, where);
}

function section(element: XmlElement, where: string): LifeSection {
	const spec = SECTIONS[element.name]!;
	const attrs = attributes(element, ["Cmd", "Type"], where);
	return {
		section: spec.section,
		...compact({ type: attrs["Type"], cmd: checkExpression(attrs["Cmd"], where) }),
		items: children(element, spec.items, where).map((child) => item(child, where)),
	};
}

function service(element: XmlElement, where: string): LifeService {
	const attrs = attributes(element, ["Type", "Tie", "Push", "Alleluia", "Move", "Cmd", "Syrnikov"], where);
	const hymns: LifeHymn[] = [];
	const sections: LifeSection[] = [];
	for (const child of children(element, [...Object.keys(SECTIONS), "TROPARION", "KONTAKION"], where)) {
		if (child.name === "TROPARION" || child.name === "KONTAKION") {
			hymns.push(hymn(child, where));
		} else {
			sections.push(section(child, where));
		}
	}
	return {
		...compact({
			type: attrs["Type"],
			tie: attrs["Tie"],
			push: attrs["Push"],
			alleluia: attrs["Alleluia"],
			move: attrs["Move"],
			cmd: checkExpression(attrs["Cmd"], where),
			syrnikov: attrs["Syrnikov"],
		}),
		hymns,
		sections,
	};
}

const INFO_ATTRIBUTES = [
	"Type", "Date", "Certainty", "Source", "Place", "Geo", "Values", "ReposeDate", "ReposePlace",
	"BirthDate", "BirthPlace", "Year", "ReposeYear", "ReposeCentury", "Note",
];

function name(element: XmlElement, where: string): LifeName {
	const attrs = attributes(element, ["Nominative", "Genetive", "Dative", "Possessive", "Short", "ShortF", "Name", "Index", "Cmd"], where);
	const [ref, ...extra] = children(element, ["REF"], where);
	if (extra.length > 0) {
		throw new Error(`${where}: <NAME> has more than one <REF>`);
	}
	return compact({
		nominative: attrs["Nominative"],
		genitive: attrs["Genetive"],
		dative: attrs["Dative"],
		possessive: attrs["Possessive"],
		short: attrs["Short"],
		shortF: attrs["ShortF"],
		name: attrs["Name"],
		index: attrs["Index"],
		cmd: checkExpression(attrs["Cmd"], where),
		refCid: ref === undefined ? undefined : attributes(ref, ["CId"], where, ["CId"])["CId"],
	});
}

function biography(element: XmlElement, where: string): LifeBiography {
	const attrs = attributes(element, ["Id", "Copyright", "Src", "Translator", "Repose"], where);
	return {
		...compact({ id: attrs["Id"], copyright: attrs["Copyright"], src: attrs["Src"], translator: attrs["Translator"], repose: attrs["Repose"] }),
		text: inlineText(element, where),
	};
}

export function convertLife(language: string, logicalPath: string): Life {
	const where = sourcePath(language, logicalPath);
	const names: LifeName[] = [];
	const biographies: LifeBiography[] = [];
	const info: Record<string, string>[] = [];
	const refs: { type?: string; cid: string }[] = [];
	const services: LifeService[] = [];
	const hymns: LifeHymn[] = [];
	const root = readXml(language, logicalPath);
	if (root.name !== "SAINT") {
		throw new Error(`${where}: root element is <${root.name}>`);
	}
	attributes(root, [], where);
	for (const child of childElements(root)) {
		switch (child.name) {
			case "NAME":
				names.push(name(child, where));
				break;
			case "LIFE":
				biographies.push(biography(child, where));
				break;
			case "INFO":
				children(child, [], where);
				info.push({ ...attributes(child, INFO_ATTRIBUTES, where) });
				break;
			case "REF": {
				const attrs = attributes(child, ["Type", "CId"], where, ["CId"]);
				refs.push({ ...compact({ type: attrs["Type"] }), cid: attrs["CId"]! });
				break;
			}
			case "SERVICE":
				services.push(service(child, where));
				break;
			case "TROPARION":
			case "KONTAKION":
				hymns.push(hymn(child, where));
				break;
			default:
				throw new Error(`${where}: <SAINT> has unexpected child <${child.name}>`);
		}
	}
	for (const child of root.children) {
		if (typeof child === "string" && child.trim() !== "") {
			throw new Error(`${where}: <SAINT> has unexpected text`);
		}
	}
	return { names, biographies, info, refs, services, hymns };
}

/** The first month whose day files (in any language) reference each commemoration id; movable-cycle ids otherwise. */
function chunkAssignments(): Map<string, LifeChunk> {
	const chunks = new Map<string, LifeChunk>();
	const referenced = (language: string, dir: string, into: (cid: string) => void): void => {
		for (const file of listFiles(language, dir)) {
			if (/^\d+\.xml$/.test(file)) {
				for (const saint of childElements(readXml(language, `${dir}/${file}`), "SAINT")) {
					const cid = saint.attributes["CId"];
					if (cid !== undefined) {
						into(cid);
					}
				}
			}
		}
	};
	for (const month of MONTHS) {
		for (const language of LANGUAGES) {
			referenced(language, month, (cid) => {
				if (!chunks.has(cid)) {
					chunks.set(cid, month as LifeChunk);
				}
			});
		}
	}
	for (const dir of ["triodion", "pentecostarion"]) {
		for (const language of LANGUAGES) {
			referenced(language, dir, (cid) => {
				if (!chunks.has(cid)) {
					chunks.set(cid, "movable");
				}
			});
		}
	}
	return chunks;
}

export function convertLives(): GeneratedFile[] {
	const assigned = chunkAssignments();
	const index: Record<string, LifeChunk> = {};
	const grouped = new Map<string, { sources: string[]; lives: Record<string, Life> }>();
	for (const language of LANGUAGES) {
		for (const file of listFiles(language, "lives")) {
			if (IGNORED.has(`${language === "" ? "" : `${language}/`}xml/lives/${file}`)) {
				continue;
			}
			const cid = file.replace(/\.xml$/, "");
			if (!/^\d+$/.test(cid)) {
				throw new Error(`${sourcePath(language, `lives/${file}`)}: unexpected life file name`);
			}
			const chunk = assigned.get(cid) ?? "other";
			index[cid] = chunk;
			const key = `${chunk}.${languageSlug(language)}`;
			let group = grouped.get(key);
			if (group === undefined) {
				group = { sources: [], lives: {} };
				grouped.set(key, group);
			}
			group.lives[cid] = convertLife(language, `lives/${file}`);
			group.sources.push(sourcePath(language, `lives/${file}`));
		}
	}
	const files: GeneratedFile[] = [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => ({
		path: `src/data/generated/lives/${key}.ts`,
		content:
			header(`${group.sources.length} files from ${group.sources[0]!.replace(/lives\/.*$/, "lives/")}`, 'import type { Life } from "../../types.ts";') +
			`export const LIVES: Readonly<Record<string, Life>> = ${literal(group.lives)};\n`,
	}));
	const sortedIndex = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
	files.push({
		path: "src/data/generated/lives/index.ts",
		content:
			header("the commemoration ids referenced by the menaion, triodion and pentecostarion day files", 'import type { LifeChunk } from "../../types.ts";') +
			`/** Month chunk of each life id; ids in no day file are "other". */\nexport const LIFE_CHUNKS: Readonly<Record<string, LifeChunk>> = ${literal(sortedIndex)};\n`,
	});
	return files;
}
