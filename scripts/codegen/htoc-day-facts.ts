// Codegen: reads `scratch/htoc-days.json` (produced by the full day-level
// scraper) plus the per-year `tests/fixtures/htoc-full-<year>.json`
// fixtures, and emits `src/data/htocDayFacts.ts` — a per-ISO-date lookup
// table of HTOC's `headerText`, `tone`, `fastText`, `commemorations`,
// `troparia`, and `kontakia`. These are the display-oriented day facts
// HTOC publishes in addition to the saint commemoration list (vendored
// separately in `htocSaints.ts` as a navigable, cId-linked subset) and
// the daily lectionary (vendored in `htocDailyLectionary.ts`).
//
// Run:   node --experimental-strip-types scripts/codegen/htoc-day-facts.ts
// Reads: scratch/htoc-days.json  (hymns: troparia + kontakia)
//        tests/fixtures/htoc-full-{2025,2026,2027}.json  (commemorations)
// Emits: src/data/htocDayFacts.ts

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface RawHymnSaint {
	readonly name: string;
	readonly href: string;
}
interface RawHymn {
	readonly title: string;
	readonly text: string;
	readonly group: number;
	readonly saints: readonly RawHymnSaint[];
}
interface RawDay {
	readonly headerText: string;
	readonly tone: number | string;
	readonly fastText: string;
	readonly troparia: readonly RawHymn[];
	readonly kontakia: readonly RawHymn[];
}
interface RawFile {
	readonly source: string;
	readonly years: readonly number[];
	readonly generatedAt: string;
	readonly count: number;
	readonly days: Readonly<Record<string, RawDay>>;
}

interface RawLivesLink {
	readonly name: string;
	readonly href: string;
}
interface RawCommemoration {
	readonly rank: string;
	readonly text: string;
	readonly minor: boolean;
	readonly lives: readonly RawLivesLink[];
}
interface FixtureDay {
	readonly commemorations: readonly RawCommemoration[];
}
interface FixtureFile {
	readonly days: Readonly<Record<string, FixtureDay>>;
}

const INPUT = resolve(process.cwd(), "scratch/htoc-days.json");
const OUTPUT = resolve(process.cwd(), "src/data/htocDayFacts.ts");
const FIXTURE_YEARS = [2025, 2026, 2027] as const;
const FIXTURE_PATH = (y: number) =>
	resolve(process.cwd(), `tests/fixtures/htoc-full-${y}.json`);

const raw = JSON.parse(readFileSync(INPUT, "utf8")) as RawFile;
const commemorationsByIso = new Map<string, readonly RawCommemoration[]>();
for (const y of FIXTURE_YEARS) {
	const fx = JSON.parse(readFileSync(FIXTURE_PATH(y), "utf8")) as FixtureFile;
	for (const [iso, day] of Object.entries(fx.days)) {
		commemorationsByIso.set(iso, day.commemorations ?? []);
	}
}

/** Extract the stable `Month/DD-NN` slug from an HTOC href URL. */
function hrefToSlug(href: string): string {
	const m = href.match(/\/los\/([^/]+\/[^.]+)/);
	return m?.[1] ?? href;
}

interface EmittedHymnSaint {
	readonly name: string;
	readonly slug: string;
}
interface EmittedHymn {
	readonly title: string;
	readonly text: string;
	readonly group: number;
	readonly saints: readonly EmittedHymnSaint[];
}
interface EmittedLivesLink {
	readonly name: string;
	readonly slug: string;
}
interface EmittedCommemoration {
	readonly rank: string;
	readonly text: string;
	readonly minor: boolean;
	readonly lives: readonly EmittedLivesLink[];
}
interface EmittedDay {
	readonly headerText: string;
	readonly tone: number | null;
	readonly fastText: string;
	readonly commemorations: readonly EmittedCommemoration[];
	readonly troparia: readonly EmittedHymn[];
	readonly kontakia: readonly EmittedHymn[];
}

function normalizeHymn(h: RawHymn): EmittedHymn {
	return {
		title: h.title,
		text: h.text,
		group: h.group,
		saints: (h.saints ?? []).map((s) => ({ name: s.name, slug: hrefToSlug(s.href) })),
	};
}

function normalizeCommemoration(c: RawCommemoration): EmittedCommemoration {
	return {
		rank: c.rank,
		text: c.text,
		minor: c.minor,
		lives: (c.lives ?? []).map((l) => ({ name: l.name, slug: hrefToSlug(l.href) })),
	};
}

const emitted = new Map<string, EmittedDay>();
let totalTroparia = 0;
let totalKontakia = 0;
let totalCommemorations = 0;
for (const [iso, day] of Object.entries(raw.days)) {
	const tone = typeof day.tone === "number" ? day.tone : null;
	const troparia = (day.troparia ?? []).map(normalizeHymn);
	const kontakia = (day.kontakia ?? []).map(normalizeHymn);
	const commemorations = (commemorationsByIso.get(iso) ?? []).map(
		normalizeCommemoration,
	);
	totalTroparia += troparia.length;
	totalKontakia += kontakia.length;
	totalCommemorations += commemorations.length;
	emitted.set(iso, {
		headerText: day.headerText ?? "",
		tone,
		fastText: day.fastText ?? "",
		commemorations,
		troparia,
		kontakia,
	});
}

const sortedDates = [...emitted.keys()].sort();

// ---------------------------------------------------------------------------
// String-pool dedup
// ---------------------------------------------------------------------------
// HTOC content has heavy intra-corpus repetition (forefeast troparia across
// consecutive days, resurrectional stichera on the 8-week tone cycle, the
// "No Troparion is given..." placeholder on hundreds of days, 23 unique
// fast-rule strings re-used across 1095 days, etc.). We intern each unique
// string once into a shared pool and reference it from the per-day record
// by integer index. A tiny hydrator at module load rebuilds the public
// `HTOC_DAY_FACTS_BY_ISO: ReadonlyMap<string, HtocDayFacts>` with the exact
// same shape and values as the previous flat-literal emit — no observable
// public-API change, but the source file is ~70% smaller.

class Pool<T> {
	readonly items: T[] = [];
	private readonly idx = new Map<string, number>();
	intern(value: T, key = JSON.stringify(value)): number {
		const hit = this.idx.get(key);
		if (hit !== undefined) return hit;
		const i = this.items.length;
		this.idx.set(key, i);
		this.items.push(value);
		return i;
	}
}

const headers = new Pool<string>();
const fasts = new Pool<string>();
const hTitles = new Pool<string>();
const hTexts = new Pool<string>();
const cTexts = new Pool<string>();
/** Pool entries are `[name, slug]` pairs shared by hymn.saints and commem.lives. */
const refs = new Pool<readonly [string, string]>();

type CompactHymn = readonly [titleIdx: number, textIdx: number, group: number, saintRefIdxs: readonly number[]];
type CompactCommem = readonly [rank: string, textIdx: number, minor: 0 | 1, livesRefIdxs: readonly number[]];
type CompactDay = readonly [
	headerIdx: number,
	tone: number | null,
	fastIdx: number,
	commemorations: readonly CompactCommem[],
	troparia: readonly CompactHymn[],
	kontakia: readonly CompactHymn[],
];

function compactHymn(h: EmittedHymn): CompactHymn {
	return [
		hTitles.intern(h.title),
		hTexts.intern(h.text),
		h.group,
		h.saints.map((s) => refs.intern([s.name, s.slug], s.name + "\x01" + s.slug)),
	];
}
function compactCommem(c: EmittedCommemoration): CompactCommem {
	return [
		c.rank,
		cTexts.intern(c.text),
		c.minor ? 1 : 0,
		c.lives.map((l) => refs.intern([l.name, l.slug], l.name + "\x01" + l.slug)),
	];
}

const compactDays: (readonly [string, CompactDay])[] = sortedDates.map((iso) => {
	const f = emitted.get(iso)!;
	const cd: CompactDay = [
		headers.intern(f.headerText),
		f.tone,
		fasts.intern(f.fastText),
		f.commemorations.map(compactCommem),
		f.troparia.map(compactHymn),
		f.kontakia.map(compactHymn),
	];
	return [iso, cd];
});

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------
function emitStringPool(name: string, docLine: string, items: readonly string[]): string {
	const body = items.map((s) => `\t${JSON.stringify(s)},`).join("\n");
	return `${docLine}\nconst ${name}: readonly string[] = [\n${body}\n];\n`;
}
function emitRefPool(items: readonly (readonly [string, string])[]): string {
	const body = items
		.map(([n, s]) => `\t[${JSON.stringify(n)}, ${JSON.stringify(s)}],`)
		.join("\n");
	return `/** Shared pool of \`[name, slug]\` pairs referenced by hymn.saints and\n * commemoration.lives. */\nconst R: readonly (readonly [string, string])[] = [\n${body}\n];\n`;
}

const lines: string[] = [];
lines.push(
	"// AUTO-GENERATED by scripts/codegen/htoc-day-facts.ts — do not edit by hand.",
	"// Source: scratch/htoc-days.json (scraped from holytrinityorthodox.com).",
	`// Generated: ${new Date().toISOString()}`,
	`// Years covered: ${raw.years.join(", ")}`,
	"",
	"/** A single HTOC-published hymn (troparion or kontakion) for one day. */",
	"export interface HtocHymn {",
	'\t/** Display title, e.g. `"Troparion, Tone IV"` or `"Holy Martyr Boniface"`. */',
	"\treadonly title: string;",
	'\t/** Hymn text. `"No Troparion is given for this service in the Menaion."` is',
	"\t *  used as a placeholder on days with no troparion for the ranked saint. */",
	"\treadonly text: string;",
	"\t/** Order-group as scraped from HTOC (used to recover display order on days",
	"\t *  with multiple saints). */",
	"\treadonly group: number;",
	"\t/** Saints this hymn is attached to. `slug` matches `HtocSaint.slug` so a",
	"\t *  consumer can join propers to the day's commemoration list without any",
	"\t *  cId lookup. May be empty for day-level (resurrectional / feast) propers. */",
	"\treadonly saints: readonly { readonly name: string; readonly slug: string }[];",
	"}",
	"",
	"/** A single commemoration as printed on HTOC's day page: the authoritative",
	" *  user-facing list of saints / feasts / commemorations for the day, with",
	" *  HTOC's rank glyph and (optionally) life-page links. Superset of the",
	" *  navigable `HtocSaint` list — includes New Hieromartyrs and other entries",
	" *  that have no life page and therefore no `cId` to join to Ponomar XML. */",
	"export interface HtocCommemoration {",
	'\t/** HTOC rank glyph: `6` Great Feast / `4` Vigil-Polyeleos / `3` Doxology /',
	'\t *  `2` Six-stich / `1` Simple / `0` No sign / `o` Octoechos (weekday). */',
	"\treadonly rank: string;",
	"\t/** Display text as printed on the day page, with punctuation. */",
	"\treadonly text: string;",
	"\t/** `true` for minor commemorations grouped as a sub-bullet under a main entry. */",
	"\treadonly minor: boolean;",
	"\t/** Life-page links. `slug` matches `HtocSaint.slug` when the commemoration",
	"\t *  has a life page in `htocSaints.ts`; empty for entries without a life. */",
	"\treadonly lives: readonly { readonly name: string; readonly slug: string }[];",
	"}",
	"",
	"/** HTOC day-level facts: title line, tone, fast rule, commemoration list,",
	" *  and the day's propers. */",
	"export interface HtocDayFacts {",
	'\t/** Header line as scraped, e.g. `"28th Week after Pentecost. Tone two."`. */',
	"\treadonly headerText: string;",
	"\t/** Resurrectional tone of the week (1..8), or `null` on Bright Week and",
	"\t *  Great Feasts of the Lord where HTOC does not print a tone. */",
	"\treadonly tone: number | null;",
	'\t/** Fast-rule display string, e.g. `"Nativity (St. Philip\'s Fast). By',
	'\t *  Monastic Charter: Strict Fast (Bread, Vegetables, Fruits)"`. Empty',
	"\t *  string on non-fast days. */",
	"\treadonly fastText: string;",
	"\t/** Full commemoration list as published by HTOC, in display order. */",
	"\treadonly commemorations: readonly HtocCommemoration[];",
	"\t/** Day's troparia in HTOC publication order. */",
	"\treadonly troparia: readonly HtocHymn[];",
	"\t/** Day's kontakia in HTOC publication order. */",
	"\treadonly kontakia: readonly HtocHymn[];",
	"}",
	"",
	"// ---------------------------------------------------------------------------",
	"// Interned string pools. HTOC content repeats heavily across the 3-year",
	"// vendored corpus (recurring forefeast troparia, octoechos cycle, 23 unique",
	"// fast strings used by 1095 days, ...), so each unique string lives here",
	"// once and per-day records reference it by integer index.",
	"// ---------------------------------------------------------------------------",
	"",
);
lines.push(emitStringPool("H", "/** Unique header lines (one per day's title bar). */", headers.items));
lines.push(emitStringPool("F", "/** Unique fast-rule display strings. */", fasts.items));
lines.push(emitStringPool("HT", "/** Unique hymn titles (troparia + kontakia). */", hTitles.items));
lines.push(emitStringPool("HX", "/** Unique hymn texts (troparia + kontakia). */", hTexts.items));
lines.push(emitStringPool("CT", "/** Unique commemoration display texts. */", cTexts.items));
lines.push(emitRefPool(refs.items));

lines.push(
	"",
	"/** Compact per-day record. Integer fields index into the pools above:",
	" *  `[headerIdx, tone, fastIdx, commemorations, troparia, kontakia]`.",
	" *  Hymns are `[titleIdx, textIdx, group, saintRefIdxs]`, commemorations",
	" *  are `[rankChar, textIdx, minor01, livesRefIdxs]`. Hydrated by `h()`",
	" *  below into the public `HtocDayFacts` shape with no behavioral change. */",
	"type CH = readonly [number, number, number, readonly number[]];",
	"type CC = readonly [string, number, 0 | 1, readonly number[]];",
	"type CD = readonly [number, number | null, number, readonly CC[], readonly CH[], readonly CH[]];",
	"",
	"const D: readonly (readonly [string, CD])[] = [",
);
for (const [iso, cd] of compactDays) {
	// Keep each day on one line but use the compact tuple shape — this is
	// typically a few hundred bytes vs. ~3 KB in the pre-dedup emit.
	lines.push(`\t[${JSON.stringify(iso)}, ${JSON.stringify(cd)}],`);
}
lines.push(
	"];",
	"",
	"function hyHymn(c: CH): HtocHymn {",
	"\treturn {",
	"\t\ttitle: HT[c[0]]!,",
	"\t\ttext: HX[c[1]]!,",
	"\t\tgroup: c[2],",
	"\t\tsaints: c[3].map((i) => ({ name: R[i]![0], slug: R[i]![1] })),",
	"\t};",
	"}",
	"function hyCommem(c: CC): HtocCommemoration {",
	"\treturn {",
	"\t\trank: c[0],",
	"\t\ttext: CT[c[1]]!,",
	"\t\tminor: c[2] === 1,",
	"\t\tlives: c[3].map((i) => ({ name: R[i]![0], slug: R[i]![1] })),",
	"\t};",
	"}",
	"function hyDay(c: CD): HtocDayFacts {",
	"\treturn {",
	"\t\theaderText: H[c[0]]!,",
	"\t\ttone: c[1],",
	"\t\tfastText: F[c[2]]!,",
	"\t\tcommemorations: c[3].map(hyCommem),",
	"\t\ttroparia: c[4].map(hyHymn),",
	"\t\tkontakia: c[5].map(hyHymn),",
	"\t};",
	"}",
	"",
	"/** ISO-date → HTOC day facts for that day.",
	" *  Coverage: 2025-01-01 through 2027-12-31 (vendored corpus window). */",
	"export const HTOC_DAY_FACTS_BY_ISO: ReadonlyMap<string, HtocDayFacts> = new Map(",
	"\tD.map(([iso, cd]) => [iso, hyDay(cd)] as const),",
	");",
	"",
	`/** Total number of troparia entries across the vendored window. */`,
	`export const HTOC_DAY_FACTS_TROPARIA_COUNT = ${totalTroparia};`,
	`/** Total number of kontakia entries across the vendored window. */`,
	`export const HTOC_DAY_FACTS_KONTAKIA_COUNT = ${totalKontakia};`,
	`/** Total number of commemorations across the vendored window. */`,
	`export const HTOC_DAY_FACTS_COMMEMORATIONS_COUNT = ${totalCommemorations};`,
	"",
);

writeFileSync(OUTPUT, lines.join("\n"), "utf8");
console.log(
	`wrote ${OUTPUT.replace(process.cwd(), "")} — ${emitted.size} days, ` +
		`${totalCommemorations} commemorations, ${totalTroparia} troparia, ` +
		`${totalKontakia} kontakia; pools: ` +
		`H=${headers.items.length} F=${fasts.items.length} ` +
		`HT=${hTitles.items.length} HX=${hTexts.items.length} ` +
		`CT=${cTexts.items.length} R=${refs.items.length}`,
);
