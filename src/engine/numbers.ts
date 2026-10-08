// Ported from Ponomar/RuleBasedNumber.java (typiconman/ponomar).
// Differences: none intended; the formatting quirks of upstream (for example, a final format with text before its
// first "#" and none after the last drops the number) are kept.

import { evaluate, evaluateBoolean } from "../core/dsl/index.ts";
import { getNumberRules } from "../data/language.ts";

/** The rules of a language's RuleBasedNumbers.xml; fields it omits keep upstream's defaults (Chinese numerals). */
export interface NumberRules {
	/** Entry `i` writes numbers from `BaN[i]` up to the next entry's base. */
	readonly DF: readonly string[];
	readonly BaN: readonly number[];
	/** Whether a zero inside a number is written. */
	readonly Cz: boolean;
	readonly zero: string;
	/** The largest number written; larger ones come back as a plain decimal. */
	readonly UB: number;
	readonly fformat: string;
}

const DEFAULT_RULES: NumberRules = {
	DF: ["一", "二", "三", "四", "五", "六", "七", "八", "九", "#十$", "#百['〇(0)','$ < 10']['一(1)','$ < 20 && $ >= 10']$", "#千$", "#萬$", "#億$"],
	BaN: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100, 1000, 10000, 100000000],
	Cz: false,
	zero: "zero",
	UB: 4999,
	fformat: "###",
};

/** The rules written in a language's phrase table (`DF`, `BaN`, `Cz`, `UB`, `fformat`, `zero`) over the defaults. */
export function parseNumberRules(table: Readonly<Record<string, string>> | undefined): NumberRules {
	if (table === undefined) {
		return DEFAULT_RULES;
	}
	return {
		DF: table["DF"]?.split("/,") ?? DEFAULT_RULES.DF,
		BaN: table["BaN"]?.split("/,").map(Number) ?? DEFAULT_RULES.BaN,
		Cz: table["Cz"] === undefined ? DEFAULT_RULES.Cz : evaluateBoolean(table["Cz"], {}),
		zero: table["zero"] ?? DEFAULT_RULES.zero,
		UB: table["UB"] === undefined ? DEFAULT_RULES.UB : Number(table["UB"]),
		fformat: table["fformat"] ?? DEFAULT_RULES.fformat,
	};
}

/** Java's `Double.toString`, which upstream splices into the conditions it evaluates. */
function javaDouble(value: number): string {
	const magnitude = Math.abs(value);
	if (magnitude >= 1e-3 && magnitude < 1e7) {
		const text = String(value);
		return text.includes(".") ? text : `${text}.0`;
	}
	if (value === 0) {
		return "0.0";
	}
	const [mantissa, exponent] = value.toExponential().split("e") as [string, string];
	return `${mantissa.includes(".") ? mantissa : `${mantissa}.0`}E${Number(exponent)}`;
}

const replaceAll = (text: string, search: string, replacement: string): string => text.split(search).join(replacement);

/** Splits `'X','location','condition'` as upstream does, after dropping the closing quote. */
function splitDirective(text: string, open: number, close: number): string[] {
	return text.substring(open + 1, close - 1).split("','");
}

function insertAt(text: string, position: number, insertion: string): string {
	return text.substring(0, position) + insertion + text.substring(position);
}

function formatPart(rules: NumberRules, value: number): string {
	if (value === 0) {
		return rules.Cz ? rules.zero : "";
	}
	let i = rules.DF.length - 1;
	while (i >= 0 && rules.BaN[i]! > value) {
		i--;
	}
	const format = rules.DF[i]!;
	const base = rules.BaN[i]!;
	const multiple = Math.trunc(value / base);
	let remainder = Math.trunc(value) - base;
	let text: string;

	const curlyOpen = format.indexOf("{");
	if (curlyOpen > -1) {
		const curlyClose = format.lastIndexOf("}");
		const inside = format.substring(curlyOpen + 1, curlyClose);
		const quoteFirst = inside.indexOf("'");
		const quoteLast = inside.lastIndexOf("'");
		const repeat = inside.substring(quoteFirst + 1, quoteLast);
		const every = Number.parseInt(inside.substring(quoteLast + 2), 10);
		const repeats = Math.trunc(remainder / every);
		text = format.substring(0, curlyOpen);
		remainder -= repeats * every;
		text += repeat.repeat(Math.max(repeats, 0));
		if (curlyClose + 1 < format.length) {
			text += format.substring(curlyClose + 1);
		}
	} else {
		text = format;
	}

	const octothorpe = format.indexOf("#");
	if (octothorpe >= 0) {
		const multiplier = formatPart(rules, multiple);
		text = text.substring(0, octothorpe) + multiplier + text.substring(octothorpe + 1);
		remainder = Math.trunc(value) - multiple * base;
	}

	for (let open = text.indexOf("["); open > -1; open = text.indexOf("[")) {
		const close = text.indexOf("]", open);
		const [character, condition] = splitDirective(text, open, close) as [string, string];
		const holds = evaluateBoolean(replaceAll(replaceAll(condition, "N", javaDouble(value)), "$", javaDouble(remainder)), {});
		text = text.substring(0, open) + (holds ? character.substring(1) : "") + text.substring(close + 1);
	}

	const dollar = text.indexOf("$");
	if (dollar > -1) {
		text = text.substring(0, dollar) + formatPart(rules, remainder) + text.substring(dollar + 1);
	}
	return text;
}

/**
 * The directives of the final format between two "#": `{'X','n'}` always inserts X and `['X','n','condition']`
 * does when the condition holds; `n` counts from the start of the number, or from its end with `fromEnd`.
 * `change` is the number of characters inserted so far, shared by both passes as upstream does.
 */
function applyDirectives(
	directives: string,
	text: string,
	change: number,
	fromEnd: boolean,
	value: number,
	length: number,
): { text: string; change: number } {
	const place = (location: number): number => {
		if (fromEnd) {
			const position = text.length - change - location;
			return position < 0 ? -change : position;
		}
		return Math.min(location, text.length - 1 - change);
	};

	for (let open = directives.indexOf("{"); open > -1; open = directives.indexOf("{", open + 1)) {
		const close = directives.indexOf("}", open);
		const [character, location] = splitDirective(directives, open, close) as [string, string];
		const where = fromEnd ? place(Number.parseInt(location, 10)) : Math.min(Number.parseInt(location, 10), text.length - 1);
		text = insertAt(text, where + change, character.substring(1));
		change++;
	}
	for (let open = directives.indexOf("["); open > -1; open = directives.indexOf("[", open + 1)) {
		const close = directives.indexOf("]", open);
		const parts = splitDirective(directives, open, close) as [string, string, string];
		const substitute = (expression: string): string => replaceAll(replaceAll(expression, "length(A)", String(length)), "N", javaDouble(value));
		if (evaluateBoolean(substitute(parts[2]), {})) {
			const location = Math.trunc(evaluate(substitute(parts[1]), {}));
			text = insertAt(text, place(location) + change, parts[0].substring(1));
			change++;
		}
	}
	return { text, change };
}

/** Writes `value` in a language's numerals (`RuleBasedNumber.getFormattedNumber`). */
export function formatRuleBasedNumber(rules: NumberRules, value: number): string {
	if (value > rules.UB) {
		return javaDouble(value);
	}
	if (value === 0) {
		return rules.zero;
	}
	const final = rules.fformat;
	const first = final.indexOf("#");
	const second = final.indexOf("#", first + 1);
	const third = final.indexOf("#", second + 1);

	let text = formatPart(rules, value);
	const length = text.length;
	let change = 0;
	({ text, change } = applyDirectives(final.substring(first + 1, second), text, change, false, value, length));
	({ text } = applyDirectives(final.substring(second + 1, third), text, change, true, value, length));

	const tail = third === final.length - 1 ? "" : final.substring(third + 1);
	return first === 0 ? text + tail : third === final.length - 1 ? final.substring(0, first) : final.substring(0, first) + text + tail;
}

/** Writes `value` in the numerals of `language`, falling back to the first language along its chain that defines rules. */
export async function formatNumber(language: string, value: number): Promise<string> {
	return formatRuleBasedNumber(parseNumberRules(await getNumberRules(language)), value);
}
