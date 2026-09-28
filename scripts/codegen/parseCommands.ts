import { readFileSync } from "node:fs";
import { parse as parseDsl } from "../../src/core/dsl/parser.ts";
import type { Command } from "../../src/data/types.ts";
import { elementChildren, parseXml } from "./xml.ts";

/**
 * Parse `Commands/DivineLiturgy.xml` (or another `<DATA><COMMAND ... /></DATA>`
 * shape). Validates that every `Value=` and `Cmd=` parses as DSL.
 */
export function parseCommandsFile(path: string): Command[] {
	const src = readFileSync(path, "utf8");
	const root = parseXml(src);
	if (root.tag !== "DATA") {
		throw new Error(`${path}: expected root <DATA>, got <${root.tag}>`);
	}
	const out: Command[] = [];
	for (const el of elementChildren(root)) {
		if (el.tag !== "COMMAND") {
			// Skip PERIOD/RULE etc.; a future codegen will handle those.
			continue;
		}
		const name = el.attrs["Name"];
		const value = el.attrs["Value"];
		if (name === undefined || value === undefined) {
			throw new Error(`${path}: <COMMAND> missing Name or Value`);
		}
		validateDsl(value, path, "Value");
		const cmd = el.attrs["Cmd"];
		if (cmd !== undefined) validateDsl(cmd, path, "Cmd");
		// Upstream uses both `Comment` and `Comments` (typo). Prefer either.
		const comment = el.attrs["Comment"] ?? el.attrs["Comments"];
		const command: Command = {
			name,
			value,
			...(cmd !== undefined ? { cmd } : {}),
			...(comment !== undefined ? { comment } : {}),
		};
		out.push(command);
	}
	return out;
}

function validateDsl(expr: string, path: string, attr: string): void {
	try {
		parseDsl(expr);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		throw new Error(`${path}: invalid DSL in ${attr}=${JSON.stringify(expr)}: ${msg}`);
	}
}
