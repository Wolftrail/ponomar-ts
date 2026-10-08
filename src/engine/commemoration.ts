// Ported from Ponomar/Commemoration1.java readCommemoration(), getGrammar(), getReadings(), getService() and getLife() (typiconman/ponomar).
// Differences: texts are trimmed and keep inline <br/> and <p> whole, where upstream keeps only the last text chunk of an element.

import { evaluateBoolean, type DslContext } from "../core/dsl/index.ts";
import { findLives } from "../data/access.ts";
import type { LifeHymn, LifeItem, LifeName, LifeScripture, LifeSectionName } from "../data/types.ts";

/** A reading of a commemoration's service, as its life file gives it. */
export type ScriptureReading = Omit<LifeScripture, "kind">;

/** A troparion or kontakion of a commemoration; `text` is the hymn. */
export type CommemorationHymn = Omit<LifeHymn, "kind">;

type ItemOf<K extends LifeItem["kind"]> = Extract<LifeItem, { kind: K }>;

/**
 * The items of one kind in one section (Vespers, Liturgy, ...) of a commemoration's service, keyed by their `type`.
 * Life files are read root first and a later item of the same type replaces an earlier one; a `Cmd` on the
 * service, the section or the item itself must hold for it to count. Items without a `type` are not reachable upstream.
 */
async function sectionItems<K extends LifeItem["kind"]>(
	cid: string,
	language: string,
	section: LifeSectionName,
	kind: K,
	context: DslContext,
): Promise<Record<string, ItemOf<K>>> {
	const items: Record<string, ItemOf<K>> = {};
	for (const life of await findLives(cid, language)) {
		for (const service of life.services) {
			if (service.cmd !== undefined && !evaluateBoolean(service.cmd, context)) {
				continue;
			}
			for (const part of service.sections) {
				if (part.section !== section || (part.cmd !== undefined && !evaluateBoolean(part.cmd, context))) {
					continue;
				}
				for (const item of part.items) {
					const cmd = item.kind === "scripture" ? item.cmd : undefined;
					if (item.kind === kind && item.type !== undefined && (cmd === undefined || evaluateBoolean(cmd, context))) {
						items[item.type] = item as ItemOf<K>;
					}
				}
			}
		}
	}
	return items;
}

/** The scripture readings of one section of a commemoration's service, keyed by their `type`. */
export async function commemorationReadings(
	cid: string,
	language: string,
	section: LifeSectionName,
	context: DslContext,
): Promise<Readonly<Record<string, ScriptureReading>>> {
	const readings: Record<string, ScriptureReading> = {};
	for (const [type, { kind: _kind, ...reading }] of Object.entries(await sectionItems(cid, language, section, "scripture", context))) {
		readings[type] = reading;
	}
	return readings;
}

/** The troparia or kontakia of one section of a commemoration's service (`getService("/LITURGY/TROPARION", type)` upstream), keyed by their `type`. */
export async function commemorationHymns(
	cid: string,
	language: string,
	section: LifeSectionName,
	kind: "troparion" | "kontakion",
	context: DslContext,
): Promise<Readonly<Record<string, CommemorationHymn>>> {
	const hymns: Record<string, CommemorationHymn> = {};
	for (const [type, { kind: _kind, ...hymn }] of Object.entries(await sectionItems(cid, language, section, kind, context))) {
		hymns[type] = hymn;
	}
	return hymns;
}

export type NameForm = "nominative" | "genitive" | "dative" | "possessive" | "short" | "shortF" | "name" | "index";

/** A commemoration's name in each form its files give; a language need not define them all. */
export type CommemorationNames = Readonly<Partial<Record<NameForm, string>>>;

const NAME_FORMS: readonly NameForm[] = ["nominative", "genitive", "dative", "possessive", "short", "shortF", "name", "index"];

/**
 * A commemoration's names for a day. Life files are read root first and every `NAME` whose `Cmd` holds
 * overrides the forms it defines, so a day-dependent name can refine a general one.
 */
export async function commemorationNames(cid: string, language: string, context: DslContext): Promise<CommemorationNames> {
	const names: Partial<Record<NameForm, string>> = {};
	for (const life of await findLives(cid, language)) {
		for (const entry of life.names) {
			if (entry.cmd !== undefined && !evaluateBoolean(entry.cmd, context)) {
				continue;
			}
			for (const form of NAME_FORMS) {
				const value = (entry as LifeName)[form];
				if (value !== undefined) {
					names[form] = value;
				}
			}
		}
	}
	return names;
}

/** The name in `form`, falling back to the nominative as upstream's `getGrammar` does; undefined where upstream reports an error. */
export function nameForm(names: CommemorationNames, form: NameForm = "nominative"): string | undefined {
	return names[form] ?? names.nominative;
}

export interface CommemorationLife {
	readonly text: string;
	readonly copyright?: string;
	/** Identifies the text in its source collection. */
	readonly id?: string;
}

/** The last biography along the language chain; its copyright and id are the last ones given, as upstream. */
export async function commemorationLife(cid: string, language: string): Promise<CommemorationLife | undefined> {
	let text: string | undefined;
	let copyright: string | undefined;
	let id: string | undefined;
	for (const life of await findLives(cid, language)) {
		for (const biography of life.biographies) {
			text = biography.text;
			copyright = biography.copyright ?? copyright;
			id = biography.id ?? id;
		}
	}
	if (text === undefined) {
		return undefined;
	}
	return { text, ...(copyright === undefined ? {} : { copyright }), ...(id === undefined ? {} : { id }) };
}
