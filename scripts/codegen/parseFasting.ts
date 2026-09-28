import { readFileSync } from "node:fs";
import { parse as parseDsl } from "../../src/core/dsl/parser.ts";
import type { FastingPeriod, FastingRule } from "../../src/data/types.ts";
import { elementChildren, parseXml } from "./xml.ts";

/** Parse `Commands/Fasting.xml` into an ordered list of `<PERIOD>` blocks.
 * Validates every `Cmd=` and every `Case=` (must be a 7-char [01] bitstring). */
export function parseFastingFile(path: string): FastingPeriod[] {
	const src = readFileSync(path, "utf8");
	const root = parseXml(src);
	if (root.tag !== "FASTING") {
		throw new Error(`${path}: expected root <FASTING>, got <${root.tag}>`);
	}
	const out: FastingPeriod[] = [];
	for (const el of elementChildren(root)) {
		if (el.tag !== "PERIOD") continue;
		const cmd = el.attrs["Cmd"];
		if (cmd !== undefined) validateDsl(cmd, path, "PERIOD.Cmd");
		const rules: FastingRule[] = [];
		for (const child of elementChildren(el)) {
			if (child.tag !== "RULE") continue;
			const caseAttr = child.attrs["Case"];
			if (caseAttr === undefined) {
				throw new Error(`${path}: <RULE> missing Case`);
			}
			if (!/^[01]{7}$/.test(caseAttr)) {
				throw new Error(
					`${path}: invalid <RULE> Case=${JSON.stringify(caseAttr)}; expected 7 chars of [01]`,
				);
			}
			const ruleCmd = child.attrs["Cmd"];
			if (ruleCmd !== undefined) validateDsl(ruleCmd, path, "RULE.Cmd");
			rules.push({
				case: caseAttr,
				...(ruleCmd !== undefined ? { cmd: ruleCmd } : {}),
			});
		}
		out.push({
			...(cmd !== undefined ? { cmd } : {}),
			rules,
		});
	}
	return out;
}

function validateDsl(expr: string, path: string, attr: string): void {
	try {
		parseDsl(expr);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		throw new Error(
			`${path}: invalid DSL in ${attr}=${JSON.stringify(expr)}: ${msg}`,
		);
	}
}
