// Walk a `languages/<lang>/xml/Services/` tree and collect every phrase XML
// file as one entry in a flat `PHRASES` map keyed by its path relative to
// `Services/` with the `.xml` extension stripped.
//
// Recognised roots (each file is `<COMMONPRAYER>` / `<TROPARION>` /
// `<KONTAKION>` / any tag with `<TEXT Value="…"/>` and optional
// `<HEADER Value="…"/>` children):
//
//   * `CommonPrayers/*.xml`             (phrase bodies used by CREATE.What)
//   * `CommonPrayers/TROPARION/*.xml`   (weekday tropar bodies)
//   * `CommonPrayers/KONTAKION/*.xml`   (weekday kontakion bodies)
//   * `Text/*.xml`                      (title / source / header labels)
//   * `Header/*.xml`                    (section headers)
//   * `Command/*.xml`                   (rubric commands)
//
// Deferred (structural, not phrase text): `Var/*.xml` and `Octoecheos/**`
// — these encode variable definitions handled elsewhere.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { Phrase } from "../../src/data/types.ts";
import { elementChildren, parseXml } from "./xml.ts";

const PHRASE_ROOTS: readonly string[] = [
	"CommonPrayers",
	"Text",
	"Header",
	"Command",
];

/** Walk one language's `Services/` tree, returning `{ key: Phrase }`. */
export function parsePhraseTree(
	servicesDir: string,
): Record<string, Phrase> {
	const out: Record<string, Phrase> = {};
	for (const rootName of PHRASE_ROOTS) {
		const rootDir = path.join(servicesDir, rootName);
		let stat;
		try {
			stat = statSync(rootDir);
		} catch {
			continue;
		}
		if (!stat.isDirectory()) continue;
		walkDir(rootDir, rootName, out);
	}
	return out;
}

function walkDir(
	dir: string,
	relPrefix: string,
	out: Record<string, Phrase>,
): void {
	for (const entry of readdirSync(dir)) {
		const full = path.join(dir, entry);
		const st = statSync(full);
		if (st.isDirectory()) {
			walkDir(full, `${relPrefix}/${entry}`, out);
			continue;
		}
		if (!entry.endsWith(".xml")) continue;
		const key = `${relPrefix}/${entry.slice(0, -".xml".length)}`;
		const phrase = parsePhraseFile(full);
		if (phrase !== null) out[key] = phrase;
	}
}

function parsePhraseFile(file: string): Phrase | null {
	const src = readFileSync(file, "utf8");
	const root = parseXml(src);
	let text: string | undefined;
	let header: string | undefined;
	for (const child of elementChildren(root)) {
		if (child.tag === "TEXT") {
			const v = child.attrs["Value"];
			if (v !== undefined) text = v;
		} else if (child.tag === "HEADER") {
			const v = child.attrs["Value"];
			if (v !== undefined) header = v;
		}
	}
	if (text === undefined) return null;
	return { text, ...(header !== undefined ? { header } : {}) };
}
