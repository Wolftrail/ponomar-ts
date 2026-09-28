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
	readonly hymns: readonly Hymn[];
}

/** A `<TROPARION>` or `<KONTAKION>` element from a lives XML file. */
export interface Hymn {
	/** Which hymn genre. Mirrors the XML element name. */
	readonly kind: "troparion" | "kontakion";
	/** Which service block the hymn was nested in (LITURGY / MATINS / …).
	 *  `unknown` when the element appears outside any recognised wrapper. */
	readonly service: ServiceContext;
	/** Raw `Type` attribute — usually an ordinal like `"1"`, `"2"`, …
	 *  Optional because a handful of upstream files omit it. */
	readonly type?: string;
	/** Raw `Tone` attribute — numeric literal or, rarely, a DSL expression. */
	readonly tone?: string;
	/** Melody/pattern reference (`<KONTAKION Podoben="…">`). */
	readonly podoben?: string;
	/** Raw StringOp DSL guard; evaluated at runtime. */
	readonly cmd?: string;
	/** Hymn text body. Contains HTML entities and inline tags
	 *  (`<p>`, `<sup>`, `&#8212;`, …); consumers should sanitize before
	 *  rendering to HTML. */
	readonly body: string;
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

/** One `<PRIME>`/`<TERCE>`/`<SEXTE>`/`<NONE>` child rule inside a
 * `<PERIOD>` of Commands/ServiceRules.xml. `type` is the required
 * template name (`Paschal` / `Easter` / `Normal` / `Lenten`); the rest
 * carry the raw template attributes to be merged into the running
 * selection. `cmd` gates whether this rule contributes. */
export interface ServiceRule {
	readonly type: string;
	readonly troparion?: string;
	readonly pickT?: string;
	readonly kontakion?: string;
	readonly pickK?: string;
	readonly lentenK?: string;
	readonly cmd?: string;
}

/** One `<PERIOD>` block in Commands/ServiceRules.xml, gated by `cmd`.
 * Contains the ordered rule lists for each of the four hours.
 * `cmd` may be missing (the trailing "special cases" period upstream carries
 * no Cmd) — an absent cmd is treated as "always applicable". */
export interface ServicePeriod {
	readonly cmd?: string;
	readonly prime: readonly ServiceRule[];
	readonly terce: readonly ServiceRule[];
	readonly sexte: readonly ServiceRule[];
	readonly none: readonly ServiceRule[];
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

/**
 * One `<SERVICES>` XML template under `languages/xml/Services/`
 * (e.g. NinthHour.xml, UsualBeginning.xml, Kathisma1.xml). Represents an
 * ordered stream of directives that compose a service.
 *
 * Text bodies live in per-language phrase XML and are NOT resolved by the
 * codegen — a directive's `what` / `file` / `verses` are opaque identifiers
 * that a consumer must map to phrase text.
 */
export interface ServiceTemplate {
	/** Basename of the template file, sans `.xml` (e.g. `"NinthHour"`). */
	readonly name: string;
	readonly title?: ServiceTitle;
	readonly directives: readonly ServiceDirective[];
}

/** `<TITLE>` element attributes. All fields are opaque phrase identifiers. */
export interface ServiceTitle {
	readonly value: string;
	readonly source?: string;
	readonly header?: string;
	readonly comment?: string;
}

export type ServiceDirective =
	| GetDirective
	| CreateDirective
	| BibleDirective;

interface DirectiveBase {
	/** Raw StringOp DSL guard, evaluated at compose time; missing means "always". */
	readonly cmd?: string;
}

/** `<GET File="..." />` — include another template inline. */
export interface GetDirective extends DirectiveBase {
	readonly kind: "get";
	readonly file: string;
	/** `Null="1"` — upstream flag; consumers may treat true as "silently
	 *  skip if target missing". */
	readonly nullable?: boolean;
}

/** `<CREATE What="..." />` — inline a phrase from the language pack. */
export interface CreateDirective extends DirectiveBase {
	readonly kind: "create";
	readonly what: string;
	readonly who?: string;
	readonly redFirst?: boolean;
	readonly newLine?: boolean;
	readonly times?: number;
	readonly command?: string;
	readonly commandB?: string;
	readonly header?: boolean;
}

/** `<BIBLE Verses="..." />` — inline a scripture passage. */
export interface BibleDirective extends DirectiveBase {
	readonly kind: "bible";
	/** Static passage reference (e.g. `"Psalm_5"`). Absent when
	 *  `getReading` is supplied instead. */
	readonly verses?: string;
	/** Dynamic passage lookup key (e.g. `"Jerem"`) — resolved at runtime by
	 *  the consumer against the day's scripture entries. */
	readonly getReading?: string;
	readonly who?: string;
	readonly redFirst?: boolean;
	readonly newLine?: boolean;
	readonly header?: boolean;
	readonly twoStars?: boolean;
}
