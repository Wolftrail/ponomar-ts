// Parses a single `lives/<cId>.xml` file into a Commemoration + optional Life.
// Both `<SAINT>` (per-language) and `<COMMEMORATION>` (language-neutral) roots
// are accepted; their child schemas are identical.
//
// Captured children:
//   * `<NAME>`      → SaintName metadata (title / subtitle / slug seed)
//   * `<CHURCH>`    → Church metadata (rank / cycle / tone)
//   * `<INFO>`      → SaintInfo biographical anchors
//   * `<SCRIPTURE>` → Scripture entries (Cmd guards are DSL-validated)
//   * `<LIFE>`      → separate Life record (prose body + attribution)

import { readFileSync } from "node:fs";
import { parse as parseDsl } from "../../src/core/dsl/parser.ts";
import type {
	Church,
	Commemoration,
	Life,
	SaintInfo,
	SaintName,
	Scripture,
	ServiceContext,
} from "../../src/data/types.ts";
import type { Element, Node } from "./xml.ts";
import { elementChildren, parseXml } from "./xml.ts";

const SERVICE_CONTEXTS: Readonly<Record<string, ServiceContext>> = {
	LITURGY: "liturgy",
	MATINS: "matins",
	VESPERS: "vespers",
	PRIMES: "primes",
	TERCE: "terce",
	SEXTE: "sexte",
	NONE: "none",
};

interface ParsedLifeFile {
	readonly commemoration: Commemoration | null;
	readonly life: Life | null;
}

/** Parse a lives XML file and return whichever facets it contained. */
export function parseLifeFile(path: string, cId: string): ParsedLifeFile {
	const src = readFileSync(path, "utf8");
	const root = parseXml(src);
	if (root.tag !== "SAINT" && root.tag !== "COMMEMORATION") {
		return { commemoration: null, life: null };
	}
	const scriptures: Scripture[] = [];
	let name: SaintName | undefined;
	let church: Church | undefined;
	let info: SaintInfo | undefined;
	let life: Life | null = null;
	visit(root, "unknown", scriptures, path, {
		set: (kind, v) => {
			if (kind === "NAME") name = v as SaintName;
			else if (kind === "CHURCH") church = v as Church;
			else if (kind === "INFO") info = v as SaintInfo;
			else if (kind === "LIFE") life = { cId, ...(v as Omit<Life, "cId">) };
		},
	});
	const hasMeta =
		scriptures.length > 0 ||
		name !== undefined ||
		church !== undefined ||
		info !== undefined;
	const commemoration: Commemoration | null = hasMeta
		? {
				cId,
				...(name !== undefined ? { name } : {}),
				...(church !== undefined ? { church } : {}),
				...(info !== undefined ? { info } : {}),
				scriptures,
			}
		: null;
	return { commemoration, life };
}

interface Sink {
	set(kind: "NAME" | "CHURCH" | "INFO" | "LIFE", value: unknown): void;
}

function visit(
	el: Element,
	inheritedService: ServiceContext,
	out: Scripture[],
	path: string,
	sink: Sink,
): void {
	const service = SERVICE_CONTEXTS[el.tag] ?? inheritedService;
	if (el.tag === "SCRIPTURE") {
		out.push(scriptureFromAttrs(el.attrs, service, path));
		return;
	}
	if (el.tag === "NAME") {
		sink.set("NAME", nameFromAttrs(el.attrs));
		return;
	}
	if (el.tag === "CHURCH") {
		sink.set("CHURCH", churchFromAttrs(el.attrs, path));
		return;
	}
	if (el.tag === "INFO") {
		sink.set("INFO", infoFromAttrs(el.attrs));
		return;
	}
	if (el.tag === "LIFE") {
		sink.set("LIFE", lifeFromElement(el));
		return;
	}
	for (const child of elementChildren(el)) visit(child, service, out, path, sink);
}

function scriptureFromAttrs(
	attrs: Readonly<Record<string, string>>,
	service: ServiceContext,
	path: string,
): Scripture {
	const type = attrs["Type"];
	const reading = attrs["Reading"];
	if (type === undefined) {
		throw new Error(`${path}: <SCRIPTURE> missing required Type`);
	}
	if (reading === undefined) {
		throw new Error(`${path}: <SCRIPTURE Type=${JSON.stringify(type)}> missing Reading`);
	}
	const pericope = attrs["Pericope"];
	const cmd = attrs["Cmd"];
	const note = attrs["Note"];
	if (cmd !== undefined) {
		try {
			parseDsl(cmd);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			throw new Error(
				`${path}: invalid DSL in SCRIPTURE Cmd=${JSON.stringify(cmd)}: ${msg}`,
			);
		}
	}
	return {
		service,
		type,
		reading,
		...(pericope !== undefined ? { pericope } : {}),
		...(cmd !== undefined ? { cmd } : {}),
		...(note !== undefined ? { note } : {}),
	};
}

function nameFromAttrs(
	attrs: Readonly<Record<string, string>>,
): SaintName | undefined {
	const out: Record<string, string> = {};
	pick(attrs, "Nominative", out, "nominative");
	pick(attrs, "Short", out, "short");
	pick(attrs, "Long", out, "long");
	pick(attrs, "ShortN", out, "shortN");
	pick(attrs, "ShortF", out, "shortF");
	pick(attrs, "Index", out, "index");
	return Object.keys(out).length === 0 ? undefined : (out as SaintName);
}

function churchFromAttrs(
	attrs: Readonly<Record<string, string>>,
	path: string,
): Church | undefined {
	const out: Record<string, number | string> = {};
	const rank = attrs["Rank"];
	if (rank !== undefined) {
		const n = parseIntStrict(rank);
		if (n !== null) out["rank"] = n;
		else out["rank"] = rank as unknown as number;
	}
	const cycle = attrs["Cycle"];
	if (cycle !== undefined) {
		const n = parseIntStrict(cycle);
		if (n !== null) out["cycle"] = n;
	}
	const tone = attrs["Tone"];
	if (tone !== undefined) {
		if (!/^-?\d+$/.test(tone.trim())) {
			try {
				parseDsl(tone);
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				throw new Error(
					`${path}: invalid DSL in CHURCH Tone=${JSON.stringify(tone)}: ${msg}`,
				);
			}
		}
		out["tone"] = tone;
	}
	return Object.keys(out).length === 0 ? undefined : (out as Church);
}

function infoFromAttrs(
	attrs: Readonly<Record<string, string>>,
): SaintInfo | undefined {
	const out: Record<string, string> = {};
	pick(attrs, "BirthY", out, "birthY");
	pick(attrs, "BirthM", out, "birthM");
	pick(attrs, "BirthD", out, "birthD");
	pick(attrs, "BirthN", out, "birthN");
	pick(attrs, "PlaceB", out, "placeB");
	// Upstream sometimes uses `Death=` as the whole year alias for `DeathY=`.
	const death = attrs["Death"];
	const deathY = attrs["DeathY"];
	if (deathY !== undefined && deathY !== "") out["deathY"] = deathY;
	else if (death !== undefined && death !== "") out["deathY"] = death;
	pick(attrs, "DeathM", out, "deathM");
	pick(attrs, "DeathD", out, "deathD");
	pick(attrs, "DeathN", out, "deathN");
	pick(attrs, "PlaceD", out, "placeD");
	return Object.keys(out).length === 0 ? undefined : (out as SaintInfo);
}

function lifeFromElement(el: Element): Omit<Life, "cId"> {
	const attrs = el.attrs;
	const body = collectText(el.children).trim();
	const out: Record<string, string> = { body };
	pick(attrs, "Id", out, "id");
	pick(attrs, "Copyright", out, "copyright");
	pick(attrs, "Translator", out, "translator");
	pick(attrs, "Repose", out, "repose");
	return out as Omit<Life, "cId">;
}

function collectText(nodes: readonly Node[]): string {
	let s = "";
	for (const n of nodes) {
		if (n.kind === "text") s += n.text;
		else s += collectText(n.element.children);
	}
	return s;
}

function pick(
	src: Readonly<Record<string, string>>,
	from: string,
	dst: Record<string, string>,
	as: string,
): void {
	const v = src[from];
	if (v === undefined || v === "") return;
	dst[as] = v;
}

function parseIntStrict(s: string): number | null {
	const t = s.trim();
	if (!/^-?\d+$/.test(t)) return null;
	return parseInt(t, 10);
}

