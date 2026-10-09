import type { ServiceNode } from "../../src/engine/service.ts";

/** The oracle's fingerprint: length and Java's String.hashCode of the trimmed text. */
export function fingerprint(text: string | undefined): string {
	if (text === undefined) {
		return "-";
	}
	const trimmed = text.trim();
	let hash = 0;
	for (let i = 0; i < trimmed.length; i++) {
		hash = (Math.imul(31, hash) + trimmed.charCodeAt(i)) | 0;
	}
	return `${trimmed.length}:${(hash >>> 0).toString(16)}`;
}

const flag = (value: boolean): string => (value ? "1" : "0");

export const orDash = (value: string | number | undefined): string => (value === undefined ? "-" : String(value));

/** One line per node in the form the oracle records directives. */
export function describeNode(node: ServiceNode): string {
	switch (node.kind) {
		case "title":
			return `title|${fingerprint(node.title)}|${fingerprint(node.windowTitle)}|${fingerprint(node.source)}|${fingerprint(node.comment)}`;
		case "subtitle":
			return `subtitle|${fingerprint(node.title)}`;
		case "prayer":
			return `prayer|${node.what}|${node.who}|${flag(node.redFirst)}|${flag(node.newLine)}|${flag(node.header)}|${orDash(node.times)}|${orDash(node.command)}|${orDash(node.commandB)}`;
		case "reading":
			// Upstream looks for an attribute "2Stars" while the data spells it "TwoStars", so it never sees one.
			return `reading|${orDash(node.verses)}|${orDash(node.intro)}|${node.who}|${flag(node.redFirst)}|${flag(node.newLine)}|${flag(node.header)}|-`;
		case "proper":
			return `proper|${node.commemorationType}|${node.id}|${node.what}|${node.who}|${flag(node.redFirst)}|${flag(node.newLine)}|${flag(node.header)}|${fingerprint(node.text)}|${node.text === undefined ? "-" : (node.headerText ?? "-")}`;
	}
}
