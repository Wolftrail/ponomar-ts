// Ported from the language-dependent parts of Ponomar/Day.java (getCommsHyper, getReadings), Ponomar/DoSaint1.java (Podobni)
// and Ponomar/Service.java (Times) (typiconman/ponomar).

import { evaluateBoolean } from "../core/dsl/index.ts";
import { getPhrase, getPodobni, getTimesLabels } from "../data/language.ts";
import { type CommemorationNames, type NameForm, nameForm } from "./commemoration.ts";

/** The attribute names the data and the language packs use for the forms of a name. */
const UPSTREAM_FORMS: Readonly<Record<string, NameForm>> = {
	Nominative: "nominative",
	Genetive: "genitive",
	Dative: "dative",
	Possessive: "possessive",
	Short: "short",
	ShortF: "shortF",
	Name: "name",
	Index: "index",
};

/**
 * The repeat count of a service line ("Twice", "5 times") in `language`. The last label whose condition holds
 * is used and `^#` in it stands for the number; an empty string if none applies.
 */
export async function formatTimes(language: string, times: number): Promise<string> {
	let text = "";
	for (const label of await getTimesLabels(language)) {
		if (label.cmd === undefined || evaluateBoolean(label.cmd, { Times: times })) {
			text = label.value;
		}
	}
	const marker = text.indexOf("^#");
	if (marker === -1) {
		return text;
	}
	// A marker at the very start of a label (index 0 or 1) leaves nothing before it, as upstream.
	const before = marker > 1 ? text.substring(0, marker).trim() : "";
	const after = marker + 2 < text.length ? text.substring(marker + 2) : "";
	return `${before}${times}${after}`;
}

/**
 * What a hymn sung "to the melody of" another is introduced with: the first words of the model hymn.
 * `podoben` is the hymn's `Podoben` attribute, which selects among the melodies of a tone.
 */
export async function podobenIntro(language: string, tone: string, podoben = ""): Promise<string | undefined> {
	let intro: string | undefined;
	for (const entry of await getPodobni(language)) {
		if (entry.tone + entry.case === tone + podoben) {
			intro = entry.intro;
		}
	}
	return intro;
}

/**
 * A commemoration's name set in the rank formatting of `language` (`Rank0` to `Rank6` phrases, markup included).
 * Ranks 6 to 8 share a format; ranks outside 1 to 8, including the sequential -2, use the plain one.
 */
export async function formatCommemoration(language: string, rank: number, name: string): Promise<string> {
	const level = rank >= 6 && rank <= 8 ? 6 : rank >= 1 && rank <= 5 ? rank : 0;
	const format = await getPhrase(language, `Rank${level}`);
	return format === undefined ? name : format.split("^NF").join(name);
}

/**
 * The tag shown after a reading that belongs to a commemoration, such as " (for Pascha)": the `Commemoration2`
 * phrase with its `%getN(^CC,Case)` grammar call replaced by the commemoration's name in that case. Undefined
 * if the language has no such phrase.
 */
export async function commemorationLabel(language: string, names: CommemorationNames): Promise<string | undefined> {
	const phrase = await getPhrase(language, "Commemoration2");
	const call = phrase?.indexOf("%getN") ?? -1;
	if (phrase === undefined || call === -1) {
		return undefined;
	}
	const close = phrase.indexOf(")");
	const grammarCase = phrase.substring(phrase.indexOf("(", call) + 1, close).split(",")[1] ?? "";
	const form = UPSTREAM_FORMS[grammarCase];
	// An unknown case falls back to the nominative, and a commemoration without one to the language's error phrase.
	const name = (form === undefined ? names.nominative : nameForm(names, form)) ?? (await getPhrase(language, "Commemoration3")) ?? "";
	return phrase.substring(0, call) + name + phrase.substring(close + 1);
}
