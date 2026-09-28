// Ported from Ponomar/StringOp.java (typiconman/ponomar) — Pratt parser.
//
// Precedence (low → high) matches the upstream recursive text-splitting
// evaluator, which splits on operators in exactly this order:
//   ||, &&, == / !=, < / <= / > / >=, + / -, * / / / %, unary ! / -.

import { type Token, type TokenKind, tokenize } from "./lexer.ts";

export type BinaryOp =
	| "||"
	| "&&"
	| "=="
	| "!="
	| "<"
	| "<="
	| ">"
	| ">="
	| "+"
	| "-"
	| "*"
	| "/"
	| "%";

export type UnaryOp = "!" | "-";

export type Expr =
	| { readonly kind: "number"; readonly value: number }
	| { readonly kind: "ident"; readonly name: string }
	| { readonly kind: "unary"; readonly op: UnaryOp; readonly operand: Expr }
	| {
			readonly kind: "binary";
			readonly op: BinaryOp;
			readonly left: Expr;
			readonly right: Expr;
	  };

export class ParseError extends Error {
	readonly source: string;
	readonly pos: number;
	constructor(message: string, source: string, pos: number) {
		super(`${message} at position ${pos} in ${JSON.stringify(source)}`);
		this.name = "ParseError";
		this.source = source;
		this.pos = pos;
	}
}

const INFIX: Partial<Record<TokenKind, { prec: number; op: BinaryOp }>> = {
	OR: { prec: 1, op: "||" },
	AND: { prec: 2, op: "&&" },
	EQ: { prec: 3, op: "==" },
	NE: { prec: 3, op: "!=" },
	LT: { prec: 4, op: "<" },
	LE: { prec: 4, op: "<=" },
	GT: { prec: 4, op: ">" },
	GE: { prec: 4, op: ">=" },
	PLUS: { prec: 5, op: "+" },
	MINUS: { prec: 5, op: "-" },
	STAR: { prec: 6, op: "*" },
	SLASH: { prec: 6, op: "/" },
	PERCENT: { prec: 6, op: "%" },
};

const UNARY_PREC = 7;

export function parse(source: string): Expr {
	const tokens = tokenize(source);
	const p = new Parser(source, tokens);
	const expr = p.parseExpr(0);
	p.expect("EOF");
	return expr;
}

class Parser {
	private i = 0;
	private readonly source: string;
	private readonly tokens: readonly Token[];
	constructor(source: string, tokens: readonly Token[]) {
		this.source = source;
		this.tokens = tokens;
	}

	parseExpr(minPrec: number): Expr {
		let left = this.parseUnary();
		while (true) {
			const tok = this.peek();
			const inf = INFIX[tok.kind];
			if (inf === undefined || inf.prec < minPrec) break;
			this.i++;
			const right = this.parseExpr(inf.prec + 1);
			left = { kind: "binary", op: inf.op, left, right };
		}
		return left;
	}

	private parseUnary(): Expr {
		const tok = this.peek();
		if (tok.kind === "NOT") {
			this.i++;
			return { kind: "unary", op: "!", operand: this.parseExpr(UNARY_PREC) };
		}
		if (tok.kind === "MINUS") {
			this.i++;
			return { kind: "unary", op: "-", operand: this.parseExpr(UNARY_PREC) };
		}
		return this.parsePrimary();
	}

	private parsePrimary(): Expr {
		const tok = this.peek();
		if (tok.kind === "NUMBER") {
			this.i++;
			return { kind: "number", value: Number(tok.text) };
		}
		if (tok.kind === "IDENT") {
			this.i++;
			return { kind: "ident", name: tok.text };
		}
		if (tok.kind === "LP") {
			this.i++;
			const inner = this.parseExpr(0);
			this.expect("RP");
			return inner;
		}
		throw new ParseError(
			`Expected expression, got ${tok.kind} ${JSON.stringify(tok.text)}`,
			this.source,
			tok.pos,
		);
	}

	private peek(): Token {
		return this.tokens[this.i] as Token;
	}

	expect(kind: TokenKind): Token {
		const tok = this.peek();
		if (tok.kind !== kind) {
			throw new ParseError(
				`Expected ${kind}, got ${tok.kind} ${JSON.stringify(tok.text)}`,
				this.source,
				tok.pos,
			);
		}
		this.i++;
		return tok;
	}
}
