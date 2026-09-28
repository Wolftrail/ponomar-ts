// Ported from Ponomar/StringOp.java (typiconman/ponomar) — tokenizer.
//
// The upstream Java `StringOp.eval` is a recursive text-splitting parser.
// This port tokenises first and then runs a Pratt parser, which yields the
// same semantics for well-formed expressions but tolerates arbitrary
// whitespace (upstream requires spaces around binary operators due to its
// `substring(0, n - 1)` / `substring(n + 2)` slicing).

export type TokenKind =
	| "NUMBER"
	| "IDENT"
	| "LP"
	| "RP"
	| "PLUS"
	| "MINUS"
	| "STAR"
	| "SLASH"
	| "PERCENT"
	| "EQ"
	| "NE"
	| "LT"
	| "LE"
	| "GT"
	| "GE"
	| "AND"
	| "OR"
	| "NOT"
	| "EOF";

export interface Token {
	readonly kind: TokenKind;
	readonly text: string;
	/** 0-based source offset where this token starts. */
	readonly pos: number;
}

export class LexError extends Error {
	readonly source: string;
	readonly pos: number;
	constructor(message: string, source: string, pos: number) {
		super(`${message} at position ${pos} in ${JSON.stringify(source)}`);
		this.name = "LexError";
		this.source = source;
		this.pos = pos;
	}
}

const SINGLE: Readonly<Record<string, TokenKind>> = {
	"(": "LP",
	")": "RP",
	"+": "PLUS",
	"-": "MINUS",
	"*": "STAR",
	"/": "SLASH",
	"%": "PERCENT",
};

export function tokenize(source: string): Token[] {
	const out: Token[] = [];
	let i = 0;
	const n = source.length;
	while (i < n) {
		const c = source[i] as string;
		if (c === " " || c === "\t" || c === "\n" || c === "\r") {
			i++;
			continue;
		}
		const start = i;
		const two = source.slice(i, i + 2);
		switch (two) {
			case "==": out.push({ kind: "EQ", text: two, pos: start }); i += 2; continue;
			case "!=": out.push({ kind: "NE", text: two, pos: start }); i += 2; continue;
			case "<=": out.push({ kind: "LE", text: two, pos: start }); i += 2; continue;
			case ">=": out.push({ kind: "GE", text: two, pos: start }); i += 2; continue;
			case "&&": out.push({ kind: "AND", text: two, pos: start }); i += 2; continue;
			case "||": out.push({ kind: "OR", text: two, pos: start }); i += 2; continue;
		}
		if (c === "<") { out.push({ kind: "LT", text: "<", pos: start }); i++; continue; }
		if (c === ">") { out.push({ kind: "GT", text: ">", pos: start }); i++; continue; }
		if (c === "!") { out.push({ kind: "NOT", text: "!", pos: start }); i++; continue; }
		const single = SINGLE[c];
		if (single !== undefined) {
			out.push({ kind: single, text: c, pos: start });
			i++;
			continue;
		}
		if (isDigit(c) || (c === "." && isDigit(source[i + 1] ?? ""))) {
			let j = i;
			while (j < n && isDigit(source[j] as string)) j++;
			if (source[j] === ".") {
				j++;
				while (j < n && isDigit(source[j] as string)) j++;
			}
			out.push({ kind: "NUMBER", text: source.slice(i, j), pos: start });
			i = j;
			continue;
		}
		if (isIdentStart(c)) {
			let j = i + 1;
			while (j < n && isIdentPart(source[j] as string)) j++;
			out.push({ kind: "IDENT", text: source.slice(i, j), pos: start });
			i = j;
			continue;
		}
		throw new LexError(`Unexpected character ${JSON.stringify(c)}`, source, i);
	}
	out.push({ kind: "EOF", text: "", pos: n });
	return out;
}

function isDigit(c: string): boolean {
	return c >= "0" && c <= "9";
}

function isIdentStart(c: string): boolean {
	return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
}

function isIdentPart(c: string): boolean {
	return isIdentStart(c) || isDigit(c);
}
