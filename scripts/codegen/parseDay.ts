import { readFileSync } from "node:fs";
import { parse as parseDsl } from "../../src/core/dsl/parser.ts";
import type { DayEntry, Saint } from "../../src/data/types.ts";
import { elementChildren, parseXml } from "./xml.ts";

/**
 * Parse a `<DAY>` file (used by pentecostarion, triodion, menaion). Validates
 * that any `Cmd=` / `Tone=` DSL expressions parse; unparseable ones cause the
 * codegen to fail fast rather than emit bad data.
 */
export function parseDayFile(path: string): DayEntry {
	const src = readFileSync(path, "utf8");
	const root = parseXml(src);
	if (root.tag !== "DAY") {
		throw new Error(`${path}: expected root <DAY>, got <${root.tag}>`);
	}
	const saints: Saint[] = [];
	for (const el of elementChildren(root)) {
		if (el.tag !== "SAINT") {
			throw new Error(`${path}: unexpected child <${el.tag}> in <DAY>`);
		}
		saints.push(saintFromAttrs(el.attrs, path));
	}
	return { saints };
}

function saintFromAttrs(
	attrs: Readonly<Record<string, string>>,
	path: string,
): Saint {
	const cId = attrs["CId"];
	if (cId === undefined) {
		throw new Error(`${path}: <SAINT> is missing required CId`);
	}
	const sIdRaw = attrs["SId"];
	const sIds =
		sIdRaw === undefined
			? []
			: sIdRaw
					.split(",")
					.map((s) => s.trim())
					.filter((s) => s.length > 0);
	const cmd = attrs["Cmd"];
	const tone = attrs["Tone"];
	const src = attrs["Src"];
	if (cmd !== undefined) validateDsl(cmd, path, "Cmd");
	if (tone !== undefined && !isBareToneLiteral(tone)) {
		validateDsl(tone, path, "Tone");
	}
	const saint: Saint = {
		sIds,
		cId,
		...(cmd !== undefined ? { cmd } : {}),
		...(tone !== undefined ? { tone } : {}),
		...(src !== undefined ? { src } : {}),
	};
	return saint;
}

function isBareToneLiteral(s: string): boolean {
	// A signed integer such as "-1" or "5" needs no DSL validation.
	return /^-?\d+$/.test(s.trim());
}

function validateDsl(expr: string, path: string, attr: string): void {
	try {
		parseDsl(expr);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		throw new Error(`${path}: invalid DSL in ${attr}=${JSON.stringify(expr)}: ${msg}`);
	}
}
