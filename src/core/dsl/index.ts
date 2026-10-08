// Reimplements the expression language evaluated by Ponomar/StringOp.java (typiconman/ponomar).
// Written from the documented behavior and verified against upstream as a black box, not translated:
// StringOp.java carries a notice forbidding copying, unlike the rest of the project.
//
// Differences: standard C-style precedence and tokenization (upstream splits on spaced operators);
// errors are thrown as DslError.

export class DslError extends Error {
	override name = "DslError";
}

export type Expression =
	| { readonly kind: "number"; readonly value: number }
	| { readonly kind: "variable"; readonly name: string }
	| { readonly kind: "unary"; readonly op: "!" | "-"; readonly operand: Expression }
	| { readonly kind: "binary"; readonly op: BinaryOperator; readonly left: Expression; readonly right: Expression };

export type BinaryOperator =
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

type Token =
	| { readonly type: "number"; readonly value: number }
	| { readonly type: "name"; readonly value: string }
	| { readonly type: "op"; readonly value: string }
	| { readonly type: "end" };

const OPERATORS = ["||", "&&", "==", "!=", "<=", ">=", "<", ">", "+", "-", "*", "/", "%", "!", "(", ")"];

function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	while (i < source.length) {
		const ch = source[i]!;
		if (/\s/.test(ch)) {
			i++;
			continue;
		}
		const number = /^(?:\d+\.?\d*|\.\d+)/.exec(source.slice(i));
		if (number) {
			tokens.push({ type: "number", value: Number(number[0]) });
			i += number[0].length;
			continue;
		}
		const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i));
		if (name) {
			tokens.push({ type: "name", value: name[0] });
			i += name[0].length;
			continue;
		}
		const op = OPERATORS.find((candidate) => source.startsWith(candidate, i));
		if (op === undefined) {
			throw new DslError(`unexpected character "${ch}" in "${source}"`);
		}
		tokens.push({ type: "op", value: op });
		i += op.length;
	}
	tokens.push({ type: "end" });
	return tokens;
}

// Lowest to highest precedence; all binary levels are left-associative.
const LEVELS: readonly (readonly BinaryOperator[])[] = [
	["||"],
	["&&"],
	["==", "!="],
	["<", "<=", ">", ">="],
	["+", "-"],
	["*", "/", "%"],
];

class Parser {
	private readonly tokens: Token[];
	private readonly source: string;
	private position = 0;

	constructor(source: string) {
		this.source = source;
		this.tokens = tokenize(source);
	}

	parse(): Expression {
		const expression = this.binary(0);
		if (this.peek().type !== "end") {
			throw new DslError(`unexpected token in "${this.source}"`);
		}
		return expression;
	}

	private peek(): Token {
		return this.tokens[this.position]!;
	}

	private matchOp(candidates: readonly string[]): string | undefined {
		const token = this.peek();
		if (token.type === "op" && candidates.includes(token.value)) {
			this.position++;
			return token.value;
		}
		return undefined;
	}

	private binary(level: number): Expression {
		const operators = LEVELS[level];
		if (operators === undefined) {
			return this.unary();
		}
		let left = this.binary(level + 1);
		for (let op = this.matchOp(operators); op !== undefined; op = this.matchOp(operators)) {
			left = { kind: "binary", op: op as BinaryOperator, left, right: this.binary(level + 1) };
		}
		return left;
	}

	private unary(): Expression {
		const op = this.matchOp(["!", "-"]);
		if (op !== undefined) {
			return { kind: "unary", op: op as "!" | "-", operand: this.unary() };
		}
		return this.primary();
	}

	private primary(): Expression {
		const token = this.peek();
		this.position++;
		if (token.type === "number") {
			return { kind: "number", value: token.value };
		}
		if (token.type === "name") {
			if (token.value === "true" || token.value === "false") {
				return { kind: "number", value: token.value === "true" ? 1 : 0 };
			}
			return { kind: "variable", name: token.value };
		}
		if (token.type === "op" && token.value === "(") {
			const inner = this.binary(0);
			if (this.matchOp([")"]) === undefined) {
				throw new DslError(`missing closing parenthesis in "${this.source}"`);
			}
			return inner;
		}
		throw new DslError(`unexpected ${token.type === "end" ? "end of expression" : `"${token.value}"`} in "${this.source}"`);
	}
}

const cache = new Map<string, Expression>();

export function parseExpression(source: string): Expression {
	let expression = cache.get(source);
	if (expression === undefined) {
		expression = new Parser(source).parse();
		cache.set(source, expression);
	}
	return expression;
}

export type DslContext = Readonly<Record<string, number>>;

export function evaluateExpression(expression: Expression, context: DslContext): number {
	switch (expression.kind) {
		case "number":
			return expression.value;
		case "variable": {
			const value = context[expression.name];
			if (value === undefined) {
				throw new DslError(`variable "${expression.name}" is not defined`);
			}
			return value;
		}
		case "unary": {
			const operand = evaluateExpression(expression.operand, context);
			return expression.op === "-" ? -operand : operand === 0 ? 1 : 0;
		}
		case "binary": {
			const left = evaluateExpression(expression.left, context);
			// As upstream (Java ||, &&), the right side is skipped when the left decides the result.
			if (expression.op === "||" && left !== 0) {
				return 1;
			}
			if (expression.op === "&&" && left === 0) {
				return 0;
			}
			const right = evaluateExpression(expression.right, context);
			switch (expression.op) {
				case "||":
					return right !== 0 ? 1 : 0;
				case "&&":
					return right !== 0 ? 1 : 0;
				case "==":
					return left === right ? 1 : 0;
				case "!=":
					return left !== right ? 1 : 0;
				case "<":
					return left < right ? 1 : 0;
				case "<=":
					return left <= right ? 1 : 0;
				case ">":
					return left > right ? 1 : 0;
				case ">=":
					return left >= right ? 1 : 0;
				case "+":
					return left + right;
				case "-":
					return left - right;
				case "*":
					return left * right;
				case "/":
					return left / right;
				case "%":
					return left % right;
			}
		}
	}
}

/** Evaluates `source` to a number; booleans are 1 and 0. */
export function evaluate(source: string, context: DslContext): number {
	return evaluateExpression(parseExpression(source), context);
}

/** Evaluates `source` as a condition; any non-zero value is true. */
export function evaluateBoolean(source: string, context: DslContext): boolean {
	return evaluate(source, context) !== 0;
}
