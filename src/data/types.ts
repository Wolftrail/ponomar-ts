// Shared, hand-written type definitions for generated data under src/data/.
// The codegen scripts import these; generated files reference them via
// import type. Do not edit generated files by hand.

/**
 * One SAINT record from a `<DAY>` XML file (pentecostarion/triodion/menaion).
 * `sIds` is a list because upstream sometimes packs multiple ids into one
 * `SId="a,b,c"` attribute.
 */
export interface Saint {
	readonly sIds: readonly string[];
	readonly cId: string;
	/** Raw StringOp DSL guard, evaluated at runtime; missing means "always". */
	readonly cmd?: string;
	/** Raw DSL expression yielding a numeric tone, or a bare literal. */
	readonly tone?: string;
	/** Source tag: G (Greek), R (Russian), U (Unsourced), etc. */
	readonly src?: string;
}

/** All saints registered for a single day of a cycle. */
export interface DayEntry {
	readonly saints: readonly Saint[];
}

/**
 * One `<COMMAND>` record from Commands/DivineLiturgy.xml (or similar).
 * `value` and `cmd` are DSL expressions.
 */
export interface Command {
	readonly name: string;
	readonly value: string;
	readonly cmd?: string;
	readonly comment?: string;
}
