// Strict reading helpers: unexpected attributes, elements or text fail the conversion so data drift is noticed.
import { parseExpression } from "../../src/core/dsl/index.ts";
import { childElements, type XmlElement } from "./xml.ts";

export function attributes(
	element: XmlElement,
	allowed: readonly string[],
	where: string,
	required: readonly string[] = [],
): Readonly<Record<string, string>> {
	for (const name of Object.keys(element.attributes)) {
		if (!allowed.includes(name)) {
			throw new Error(`${where}: <${element.name}> has unexpected attribute ${name}`);
		}
	}
	for (const name of required) {
		if (element.attributes[name] === undefined) {
			throw new Error(`${where}: <${element.name}> is missing attribute ${name}`);
		}
	}
	return element.attributes;
}

/** `ignoredText` lists exact stray strings known to be typos in the source; any other text is an error. */
export function children(element: XmlElement, allowed: readonly string[], where: string, ignoredText: readonly string[] = []): XmlElement[] {
	for (const child of element.children) {
		if (typeof child === "string") {
			if (child.trim() !== "" && !ignoredText.includes(child.trim())) {
				throw new Error(`${where}: <${element.name}> has unexpected text "${child.trim().slice(0, 40)}"`);
			}
		} else if (!allowed.includes(child.name)) {
			throw new Error(`${where}: <${element.name}> has unexpected child <${child.name}>`);
		}
	}
	return childElements(element);
}

/** Rejects an expression the evaluator cannot parse, naming the file it came from. */
export function checkExpression(source: string | undefined, where: string): string | undefined {
	if (source === undefined) {
		return undefined;
	}
	try {
		parseExpression(source.replace(/\s+/g, " ").trim());
	} catch (error) {
		throw new Error(`${where}: ${(error as Error).message}`);
	}
	return source;
}

/** Copies `entries` whose value is defined, so optional properties are omitted rather than set to undefined. */
export function compact<T extends Record<string, string | undefined>>(entries: T): { [K in keyof T]?: string } {
	return Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined)) as { [K in keyof T]?: string };
}
