// Resolve phrase directives to their English text bodies.
//
// Phase 8c-ii surfaces the flat `PHRASES` map (per-language, English-only for
// now) plus small convenience resolvers that encode the upstream
// Ponomar/Service.java lookup conventions:
//
//   * `CREATE What="X"`          → `CommonPrayers/X`
//   * `CREATE Command="X"`       → `Command/X`   (rubric label)
//   * `CREATE CommandB="X"`      → `Command/X`   (secondary label)
//   * `BIBLE Header="1" Verses="Psalm_5"` → `Header/Psalm5`
//   * `TITLE Value | Source | Header | Comment` → `Text/<name>`
//
// The resolvers return `undefined` when the reference doesn't map to any
// phrase in the shipped language pack — this happens both for dynamically
// generated Var/ content and for optional includes.

import { PHRASES } from "../data/index.ts";
import type {
	BibleDirective,
	CreateDirective,
	Phrase,
	ServiceTitle,
} from "../data/index.ts";

/** Return the phrase for a raw key, e.g. `"CommonPrayers/BlessedIsOurGod"`. */
export function getPhrase(key: string): Phrase | undefined {
	return PHRASES[key];
}

/** Resolve a `<CREATE What="…"/>` directive to its phrase body. */
export function resolveCreate(directive: CreateDirective): Phrase | undefined {
	return PHRASES[`CommonPrayers/${directive.what}`];
}

/** Resolve the rubric label attached via `Command=` on a directive. */
export function resolveCommand(name: string): Phrase | undefined {
	return PHRASES[`Command/${name}`];
}

/** Resolve the section header for a `<BIBLE>` directive when `Header="1"`.
 *  Uses the leading token of `Verses` (stripping the `_ref` suffix), matching
 *  upstream's `Header/<Psalm5>.xml` naming. Returns `undefined` for the
 *  dynamic (`getReading=`) form since no static header applies. */
export function resolveBibleHeader(
	directive: BibleDirective,
): Phrase | undefined {
	if (directive.verses === undefined) return undefined;
	const key = bibleHeaderKey(directive.verses);
	return PHRASES[`Header/${key}`];
}

/** Resolve every text-labelled field on a `<TITLE>` element. */
export interface ResolvedTitle {
	readonly value?: string;
	readonly source?: string;
	readonly header?: string;
	readonly comment?: string;
}

export function resolveTitle(title: ServiceTitle): ResolvedTitle {
	const out: Record<string, string> = {};
	assign(out, "value", PHRASES[`Text/${title.value}`]);
	if (title.source !== undefined)
		assign(out, "source", PHRASES[`Text/${title.source}`]);
	if (title.header !== undefined)
		assign(out, "header", PHRASES[`Text/${title.header}`]);
	if (title.comment !== undefined)
		assign(out, "comment", PHRASES[`Text/${title.comment}`]);
	return out;
}

function assign(
	out: Record<string, string>,
	key: string,
	p: Phrase | undefined,
): void {
	if (p !== undefined) out[key] = p.text;
}

/** Strip the `_...` suffix from a Verses ref to produce a header lookup key. */
function bibleHeaderKey(verses: string): string {
	const underscore = verses.indexOf("_");
	if (underscore < 0) return verses;
	const book = verses.slice(0, underscore);
	const rest = verses.slice(underscore + 1);
	// Header files are named e.g. `Psalm5.xml` — join book + first token.
	const token = rest.split(/[:,.\-\s]/)[0] ?? "";
	return `${book}${token}`;
}
