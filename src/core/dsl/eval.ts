// Ported from Ponomar/StringOp.java (typiconman/ponomar) — evaluator.
//
// Semantics mirror upstream:
//   * Every operator returns a `double`. Booleans are 1.0 / 0.0.
//   * `&&`, `||`, `!` coerce their operands via `value !== 0 → true`.
//   * `true` / `false` are reserved identifiers.
//   * Variables come from a plain lookup table. Missing names throw.
//   * Numeric semantics use JS number (IEEE-754 double), matching Java double.

import { type Expr, ParseError, parse } from "./parser.ts";

export type Context = Readonly<Record<string, number | boolean>>;

export class EvalError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EvalError";
	}
}

const RESERVED: Readonly<Record<string, number>> = {
	true: 1,
	false: 0,
};

export function evaluate(source: string, ctx: Context): number {
	return evalExpr(parse(source), ctx);
}

export function evaluateBool(source: string, ctx: Context): boolean {
	return evalExpr(parse(source), ctx) !== 0;
}

export function evaluateAst(expr: Expr, ctx: Context): number {
	return evalExpr(expr, ctx);
}

function evalExpr(expr: Expr, ctx: Context): number {
	switch (expr.kind) {
		case "number":
			return expr.value;
		case "ident": {
			const reserved = RESERVED[expr.name];
			if (reserved !== undefined) return reserved;
			if (!Object.prototype.hasOwnProperty.call(ctx, expr.name)) {
				throw new EvalError(
					`Unknown variable ${JSON.stringify(expr.name)}`,
				);
			}
			const v = ctx[expr.name];
			if (typeof v === "boolean") return v ? 1 : 0;
			if (typeof v !== "number" || !Number.isFinite(v)) {
				throw new EvalError(
					`Variable ${JSON.stringify(expr.name)} is not a finite number`,
				);
			}
			return v;
		}
		case "unary": {
			const v = evalExpr(expr.operand, ctx);
			return expr.op === "!" ? (v !== 0 ? 0 : 1) : -v;
		}
		case "binary": {
			// Short-circuit && / ||: safe here because expressions are pure.
			if (expr.op === "&&") {
				return evalExpr(expr.left, ctx) !== 0 && evalExpr(expr.right, ctx) !== 0
					? 1
					: 0;
			}
			if (expr.op === "||") {
				return evalExpr(expr.left, ctx) !== 0 || evalExpr(expr.right, ctx) !== 0
					? 1
					: 0;
			}
			const l = evalExpr(expr.left, ctx);
			const r = evalExpr(expr.right, ctx);
			switch (expr.op) {
				case "==": return l === r ? 1 : 0;
				case "!=": return l !== r ? 1 : 0;
				case "<":  return l < r ? 1 : 0;
				case "<=": return l <= r ? 1 : 0;
				case ">":  return l > r ? 1 : 0;
				case ">=": return l >= r ? 1 : 0;
				case "+":  return l + r;
				case "-":  return l - r;
				case "*":  return l * r;
				case "/":  return l / r;
				case "%":  return l % r;
			}
		}
	}
}

export { ParseError };
