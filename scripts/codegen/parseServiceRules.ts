import { readFileSync } from "node:fs";
import { parse as parseDsl } from "../../src/core/dsl/parser.ts";
import type { ServicePeriod, ServiceRule } from "../../src/data/types.ts";
import { elementChildren, parseXml } from "./xml.ts";

const HOUR_TAGS = ["PRIME", "TERCE", "SEXTE", "NONE"] as const;
type HourTag = (typeof HOUR_TAGS)[number];

/** Parse `Commands/ServiceRules.xml` into an ordered list of `<PERIOD>` blocks.
 * Every `Cmd=` (period and rule) is validated as DSL at build time. */
export function parseServiceRulesFile(path: string): ServicePeriod[] {
	const src = readFileSync(path, "utf8");
	const root = parseXml(src);
	if (root.tag !== "DATA") {
		throw new Error(`${path}: expected root <DATA>, got <${root.tag}>`);
	}
	const out: ServicePeriod[] = [];
	for (const el of elementChildren(root)) {
		if (el.tag !== "PERIOD") continue;
		const cmd = el.attrs["Cmd"];
		if (cmd !== undefined) validateDsl(cmd, path, "PERIOD.Cmd");
		const buckets: Record<HourTag, ServiceRule[]> = {
			PRIME: [],
			TERCE: [],
			SEXTE: [],
			NONE: [],
		};
		for (const child of elementChildren(el)) {
			if (!isHourTag(child.tag)) continue;
			const rule = parseRule(child.tag, child.attrs, path);
			buckets[child.tag].push(rule);
		}
		out.push({
			...(cmd !== undefined ? { cmd } : {}),
			prime: buckets.PRIME,
			terce: buckets.TERCE,
			sexte: buckets.SEXTE,
			none: buckets.NONE,
		});
	}
	return out;
}

function parseRule(
	tag: HourTag,
	attrs: Readonly<Record<string, string>>,
	path: string,
): ServiceRule {
	const type = attrs["Type"];
	if (type === undefined) {
		throw new Error(`${path}: <${tag}> missing required Type`);
	}
	const ruleCmd = attrs["Cmd"];
	if (ruleCmd !== undefined) validateDsl(ruleCmd, path, `${tag}.Cmd`);
	const rule: ServiceRule = {
		type,
		...optString(attrs, "Troparion", "troparion"),
		...optString(attrs, "PickT", "pickT"),
		...optString(attrs, "Kontakion", "kontakion"),
		...optString(attrs, "PickK", "pickK"),
		...optString(attrs, "LENTENK", "lentenK"),
		...(ruleCmd !== undefined ? { cmd: ruleCmd } : {}),
	};
	return rule;
}

function optString(
	attrs: Readonly<Record<string, string>>,
	xmlName: string,
	tsName: string,
): Record<string, string> {
	const v = attrs[xmlName];
	return v === undefined ? {} : { [tsName]: v };
}

function isHourTag(tag: string): tag is HourTag {
	return (HOUR_TAGS as readonly string[]).includes(tag);
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
