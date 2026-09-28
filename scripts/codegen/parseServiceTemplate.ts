// Parses a single language-neutral service template under
// `languages/xml/Services/<Name>.xml` into a ServiceTemplate.
//
// Supported elements under `<SERVICES>` (in document order):
//   * `<TITLE Value=… Source=… Header=… Comment=…/>` — at most one.
//   * `<GET File=… Cmd=… Null=…/>`                    — include reference.
//   * `<CREATE What=… …/>`                            — phrase directive.
//   * `<BIBLE Verses=… …/>`                           — scripture directive.
//
// Every `Cmd=` attribute is DSL-validated at build time. Boolean-flag
// attributes (`RedFirst`, `NewLine`, `Header`, `Null`, `TwoStars`) are
// captured only when set to `"1"`; other values are ignored.

import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseDsl } from "../../src/core/dsl/parser.ts";
import type {
	BibleDirective,
	CreateDirective,
	GetDirective,
	ServiceDirective,
	ServiceTemplate,
	ServiceTitle,
} from "../../src/data/types.ts";
import type { Element } from "./xml.ts";
import { elementChildren, parseXml } from "./xml.ts";

/** Parse one service template file. */
export function parseServiceTemplate(file: string): ServiceTemplate {
	const src = readFileSync(file, "utf8");
	const root = parseXml(src);
	if (root.tag !== "SERVICES") {
		throw new Error(`${file}: expected <SERVICES> root, got <${root.tag}>`);
	}
	const name = path.basename(file, ".xml");
	let title: ServiceTitle | undefined;
	const directives: ServiceDirective[] = [];
	for (const child of elementChildren(root)) {
		if (child.tag === "TITLE") {
			title = parseTitle(child, file);
			continue;
		}
		const d = parseDirective(child, file);
		if (d !== null) directives.push(d);
	}
	return {
		name,
		...(title !== undefined ? { title } : {}),
		directives,
	};
}

function parseTitle(el: Element, file: string): ServiceTitle {
	const value = el.attrs["Value"];
	if (value === undefined) {
		throw new Error(`${file}: <TITLE> missing required Value`);
	}
	const source = el.attrs["Source"];
	const header = el.attrs["Header"];
	const comment = el.attrs["Comment"];
	return {
		value,
		...(source !== undefined ? { source } : {}),
		...(header !== undefined ? { header } : {}),
		...(comment !== undefined ? { comment } : {}),
	};
}

function parseDirective(el: Element, file: string): ServiceDirective | null {
	switch (el.tag) {
		case "GET":
			return parseGet(el, file);
		case "CREATE":
			return parseCreate(el, file);
		case "BIBLE":
			return parseBible(el, file);
		default:
			return null;
	}
}

function parseGet(el: Element, file: string): GetDirective {
	const fileRef = el.attrs["File"];
	if (fileRef === undefined) {
		throw new Error(`${file}: <GET> missing required File`);
	}
	const cmd = validateCmd(el.attrs["Cmd"], el.tag, file);
	const nullable = flag(el.attrs["Null"]);
	return {
		kind: "get",
		file: fileRef,
		...(nullable ? { nullable: true } : {}),
		...(cmd !== undefined ? { cmd } : {}),
	};
}

function parseCreate(el: Element, file: string): CreateDirective {
	const what = el.attrs["What"];
	if (what === undefined) {
		throw new Error(`${file}: <CREATE> missing required What`);
	}
	const cmd = validateCmd(el.attrs["Cmd"], el.tag, file);
	const times = intAttr(el.attrs["Times"], "Times", file);
	return {
		kind: "create",
		what,
		...strAttr(el.attrs, "Who", "who"),
		...boolAttr(el.attrs, "RedFirst", "redFirst"),
		...boolAttr(el.attrs, "NewLine", "newLine"),
		...(times !== undefined ? { times } : {}),
		...strAttr(el.attrs, "Command", "command"),
		...strAttr(el.attrs, "CommandB", "commandB"),
		...boolAttr(el.attrs, "Header", "header"),
		...(cmd !== undefined ? { cmd } : {}),
	};
}

function parseBible(el: Element, file: string): BibleDirective {
	const verses = el.attrs["Verses"];
	const getReading = el.attrs["getReading"];
	if (verses === undefined && getReading === undefined) {
		throw new Error(
			`${file}: <BIBLE> requires either Verses or getReading`,
		);
	}
	const cmd = validateCmd(el.attrs["Cmd"], el.tag, file);
	return {
		kind: "bible",
		...(verses !== undefined ? { verses } : {}),
		...(getReading !== undefined ? { getReading } : {}),
		...strAttr(el.attrs, "Who", "who"),
		...boolAttr(el.attrs, "RedFirst", "redFirst"),
		...boolAttr(el.attrs, "NewLine", "newLine"),
		...boolAttr(el.attrs, "Header", "header"),
		...boolAttr(el.attrs, "TwoStars", "twoStars"),
		...(cmd !== undefined ? { cmd } : {}),
	};
}

function validateCmd(
	cmd: string | undefined,
	tag: string,
	file: string,
): string | undefined {
	if (cmd === undefined) return undefined;
	try {
		parseDsl(cmd);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		throw new Error(
			`${file}: invalid DSL in <${tag}> Cmd=${JSON.stringify(cmd)}: ${msg}`,
		);
	}
	return cmd;
}

function flag(v: string | undefined): boolean {
	return v === "1";
}

function strAttr(
	attrs: Readonly<Record<string, string>>,
	from: string,
	to: string,
): Record<string, string> {
	const v = attrs[from];
	if (v === undefined || v === "") return {};
	return { [to]: v };
}

function boolAttr(
	attrs: Readonly<Record<string, string>>,
	from: string,
	to: string,
): Record<string, boolean> {
	return flag(attrs[from]) ? { [to]: true } : {};
}

function intAttr(
	v: string | undefined,
	name: string,
	file: string,
): number | undefined {
	if (v === undefined) return undefined;
	const t = v.trim();
	if (!/^\d+$/.test(t)) {
		throw new Error(
			`${file}: <CREATE> ${name}=${JSON.stringify(v)} is not a non-negative integer`,
		);
	}
	return parseInt(t, 10);
}
