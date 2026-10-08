// Shapes of the data converted from the vendored Ponomar XML by scripts/convert.

/** One <SAINT> of a day file. `cid` names the commemoration file; `sid` lists saint ids (comma-separated upstream, empty when absent). */
export interface DaySaint {
	readonly sid: readonly string[];
	readonly cid: string;
	/** Source of the entry: G (Greek), R (Russian) or U (unsourced). Menaion files only. */
	readonly src?: string;
	/** Condition in the expression language; the entry applies only when it is true. */
	readonly cmd?: string;
	/** Tone as a number or expression; -1 means "use the computed tone". Triodion and Pentecostarion only. */
	readonly tone?: string;
	readonly type?: string;
}

/** The commemorations of one day, in file order. */
export type DayFile = readonly DaySaint[];

export interface FloatScripture {
	readonly type: string;
	readonly reading: string;
	readonly note?: string;
	readonly pericope?: string;
}

export interface FloatSaint {
	readonly name: string;
	readonly id: string;
	readonly type: string;
}

/** A floating feast: readings and the commemoration they belong to. */
export interface FloatFile {
	readonly scriptures: readonly FloatScripture[];
	readonly saints: readonly FloatSaint[];
}

export interface FastingRule {
	/** Seven-digit fasting level, e.g. "0000111" (see Fasting.xml). */
	readonly level: string;
	readonly cmd?: string;
}

/** A period of the year with its fasting rules; a later matching rule overrides an earlier one. */
export interface FastingPeriod {
	readonly cmd?: string;
	readonly rules: readonly FastingRule[];
}

export type ServiceHour = "prime" | "terce" | "sexte" | "none";

export interface ServiceRuleEntry {
	readonly hour: ServiceHour;
	readonly type: string;
	readonly troparion?: string;
	readonly pickT?: string;
	readonly kontakion?: string;
	readonly pickK?: string;
	readonly lentenK?: string;
	readonly cmd?: string;
}

export interface ServiceRulePeriod {
	readonly cmd?: string;
	readonly entries: readonly ServiceRuleEntry[];
}

/** A named rule of DivineLiturgy.xml or ScriptureTransfers.xml; `value` is an expression. */
export interface LiturgyCommand {
	readonly name: string;
	readonly value: string;
	readonly cmd?: string;
	readonly comment?: string;
}

/** One of the "Times" labels (twice, thrice, N times); the first whose `cmd` holds for `Times` applies. `^#` stands for the number. */
export interface TimesLabel {
	readonly value: string;
	readonly cmd?: string;
}

/** A model melody ("podoben") that other hymns follow, identified by tone (0 is tone 8) and case. */
export interface Podoben {
	readonly tone: string;
	readonly case: string;
	readonly intro: string;
	readonly comment: string;
}

/**
 * What one language directory defines in its `Commands/`. A field is omitted when that directory has no such
 * file, so lookups fall back along the language chain file by file, as upstream does. Translator-comment
 * attributes of phrases are not kept. Values may contain markup and `^` placeholders exactly as upstream.
 */
export interface LanguagePackData {
	readonly phrases?: Readonly<Record<string, string>>;
	readonly times?: readonly TimesLabel[];
	readonly podobni?: readonly Podoben[];
	/** Rules of RuleBasedNumbers.xml keyed as upstream. */
	readonly numberRules?: Readonly<Record<string, string>>;
}

/** Name forms of a commemoration, in the grammatical cases a language needs. */
export interface LifeName {
	readonly nominative?: string;
	readonly genitive?: string;
	readonly dative?: string;
	readonly possessive?: string;
	readonly short?: string;
	readonly shortF?: string;
	readonly name?: string;
	readonly index?: string;
	readonly cmd?: string;
	/** Commemoration whose name this one reuses. */
	readonly refCid?: string;
}

/** Biography text with provenance. Inline `<br/>` and `<p>` markup is kept as HTML in `text`. */
export interface LifeBiography {
	readonly id?: string;
	readonly copyright?: string;
	readonly src?: string;
	readonly translator?: string;
	readonly repose?: string;
	readonly text: string;
}

export interface LifeScripture {
	readonly kind: "scripture";
	readonly type: string;
	readonly reading: string;
	readonly pericope?: string;
	readonly cmd?: string;
	readonly note?: string;
	readonly effWeek?: string;
}

/** A troparion or kontakion with its attributes; `text` is the hymn. */
export interface LifeHymn {
	readonly kind: "troparion" | "kontakion";
	readonly text: string;
	readonly type?: string;
	readonly tone?: string;
	readonly podoben?: string;
	readonly header?: string;
	readonly author?: string;
	readonly comment?: string;
	readonly translator?: string;
}

/** Royal Hours and Sixth Hour texts: idiomela, prokeimena, verses and stichoi. */
export interface LifeVerse {
	readonly kind: "idiomel" | "prokeimenon" | "verse" | "stichos";
	readonly text: string;
	readonly type?: string;
	readonly tone?: string;
	readonly header?: string;
	readonly author?: string;
}

export type LifeItem = LifeScripture | LifeHymn | LifeVerse;

export type LifeSectionName = "liturgy" | "matins" | "none" | "primes" | "terce" | "sexte" | "vespers" | "royalhours";

/** A service part (Vespers, Liturgy, ...) with its readings and texts in file order. */
export interface LifeSection {
	readonly section: LifeSectionName;
	readonly type?: string;
	readonly cmd?: string;
	readonly items: readonly LifeItem[];
}

export interface LifeService {
	/** Rank of the commemoration; the first such value upstream reads wins. */
	readonly type?: string;
	readonly tie?: string;
	readonly push?: string;
	readonly alleluia?: string;
	readonly move?: string;
	readonly cmd?: string;
	readonly syrnikov?: string;
	/** Hymns placed directly in the service, outside any section. */
	readonly hymns: readonly LifeHymn[];
	readonly sections: readonly LifeSection[];
}

/**
 * One language directory's `lives/<cid>.xml`. Upstream reads the root file and then each language
 * directory along the chain, merging them, so a file here may carry only part of a commemoration.
 */
export interface Life {
	readonly names: readonly LifeName[];
	readonly biographies: readonly LifeBiography[];
	/** Biographical facts as upstream attributes (BirthDate, ReposePlace, ...). */
	readonly info: readonly Readonly<Record<string, string>>[];
	readonly refs: readonly { readonly type?: string; readonly cid: string }[];
	readonly services: readonly LifeService[];
	/** Hymns placed directly under the commemoration. */
	readonly hymns: readonly LifeHymn[];
}

/**
 * A book of the Bible as readings name it. Only the catalogue is shipped; Bible text is left to the
 * consumer. Ids use underscores for numbered books (`I_Cor`).
 */
export interface BibleBook {
	readonly id: string;
	/** English name and short form, from the English King James entry. */
	readonly name: string;
	readonly short: string;
	readonly chapters: number;
	/** Chapter counts in other translations when they differ from `chapters`. */
	readonly alternativeChapters?: readonly number[];
}

/** Which month chunk holds a life; "movable" covers triodion/pentecostarion, "other" the unreferenced rest. */
export type LifeChunk = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12" | "movable" | "other";
