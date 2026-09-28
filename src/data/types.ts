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

/**
 * Which service block a `<SCRIPTURE>` element was nested in.
 * `unknown` is used when a SCRIPTURE appears outside any recognised wrapper.
 */
export type ServiceContext =
	| "liturgy"
	| "matins"
	| "vespers"
	| "primes"
	| "terce"
	| "sexte"
	| "none"
	| "unknown";

/** One `<SCRIPTURE>` element from a saint's lives XML. */
export interface Scripture {
	readonly service: ServiceContext;
	/** Raw `Type` attribute: `apostol`, `gospel`, `matins`, `vespers`, `1`, `2`, `3`, ... */
	readonly type: string;
	/** Bible reference expression, e.g. `Heb_13:7-16` or `Composite_3`. */
	readonly reading: string;
	readonly pericope?: string;
	/** Raw StringOp DSL guard; evaluated at runtime. */
	readonly cmd?: string;
	readonly note?: string;
}

/** `<NAME>` attributes on a commemoration. All are optional and free-form English strings. */
export interface SaintName {
	readonly nominative?: string;
	readonly short?: string;
	readonly long?: string;
	readonly shortN?: string;
	readonly shortF?: string;
	readonly index?: string;
}

/** `<CHURCH>` attributes: rank/cycle in upstream numbering; tone kept raw (may be DSL). */
export interface Church {
	/** 0 = Pascha, 1 = Great Feast, ... 8 = Simple service. */
	readonly rank?: number;
	readonly cycle?: number;
	readonly tone?: string;
}

/** `<INFO>` attributes: biographical anchors (birth/death year, month, day, place). */
export interface SaintInfo {
	readonly birthY?: string;
	readonly birthM?: string;
	readonly birthD?: string;
	readonly birthN?: string;
	readonly placeB?: string;
	readonly deathY?: string;
	readonly deathM?: string;
	readonly deathD?: string;
	readonly deathN?: string;
	readonly placeD?: string;
}

/** All non-prose metadata for a single saint, keyed by `cId` in the emitted map. */
export interface Commemoration {
	readonly cId: string;
	readonly name?: SaintName;
	readonly church?: Church;
	readonly info?: SaintInfo;
	readonly scriptures: readonly Scripture[];
}

/** One `<RULE>` inside a `<PERIOD>` in Commands/Fasting.xml.
 * `case` is a 7-character bitstring like `"0000111"`. See `FastingLevel`
 * in `src/engine/fasting.ts` for the semantics of each bit position. */
export interface FastingRule {
	readonly case: string;
	readonly cmd?: string;
}

/** One `<PERIOD>` block in Commands/Fasting.xml. Skipped entirely when `cmd`
 * evaluates to false; otherwise its rules are evaluated in document order and
 * the last-matching rule's `case` wins. */
export interface FastingPeriod {
	readonly cmd?: string;
	readonly rules: readonly FastingRule[];
}

/**
 * The `<LIFE>` element for a saint: the prose "story" plus its attribution.
 * `body` may be empty if upstream only recorded metadata (e.g. `Repose="4th Century"`).
 * Prose contains HTML-like entities (`<p>`, `<a>`, `&#8212;`, ...) — consumers
 * should treat it as untrusted markup and sanitize before rendering.
 */
export interface Life {
	readonly cId: string;
	readonly body: string;
	readonly id?: string;
	readonly copyright?: string;
	readonly translator?: string;
	readonly repose?: string;
}
