// Codegen: reads `scratch/htoc-days.json` (produced by the full day-level
// scraper) plus the per-year `tests/fixtures/htoc-full-<year>.json`
// fixtures, and emits `src/data/dayFacts.ts` — a per-ISO-date lookup
// table of HTOC's `headerText`, `tone`, `fastText`, `commemorations`,
// `troparia`, and `kontakia`. These are the display-oriented day facts
// HTOC publishes in addition to the saint commemoration list (vendored
// separately in `saints.ts` as a navigable, cId-linked subset) and
// the daily lectionary (vendored in `dailyLectionary.ts`).
//
// Run:   node --experimental-strip-types scripts/codegen/day-facts.ts
// Reads: scratch/htoc-days.json  (hymns: troparia + kontakia)
//        tests/fixtures/htoc-full-{2025,2026,2027}.json  (commemorations)
// Emits: src/data/dayFacts.ts

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
const OUTPUT = resolve(process.cwd(), "src/data/dayFacts.ts");
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
	const { rank, text } = normalizeKnownDrift(c.rank, c.text);
	return {
		rank,
		text,
		minor: c.minor,
		lives: (c.lives ?? []).map((l) => ({ name: l.name, slug: hrefToSlug(l.href) })),
	};
}

/**
 * HTOC occasionally publishes the same movable feast with inconsistent rank
 * glyphs and typography across years. We pin canonical values here so the
 * vendored lookup table matches the composer's (deterministic) output.
 *
 * Known cases:
 *  - "Synaxis of New Martyrs and Confessors of Kazakhstan" — HTOC drifts
 *    rank between "0" and "1" and spells the date as "September 3 rd"
 *    (with space) or "September 3rd". Canonical references (azbyka.ru:
 *    tropar gl.7, kondak gl.5, canon gl.2, величание) support rank "1".
 *    See `/memories/repo/data-drift.md`.
 */
function normalizeKnownDrift(rank: string, text: string): { rank: string; text: string } {
	if (text.includes("New Martyrs and Confessors of Kazakhstan")) {
		return {
			rank: "1",
			text: "Synaxis of New Martyrs and Confessors of Kazakhstan ( movable holiday on the Sunday after September 3rd ).",
		};
	}
	return { rank, text };
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
// `DAY_FACTS_BY_ISO: ReadonlyMap<string, DayFacts>` with the exact
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
/** Compact per-day record. All six fields index into pools:
 *  - `headerIdx` → `H`, `fastIdx` → `F`
 *  - `commemArrIdx` → `A` (array of `CC`-pool indices)
 *  - `tropArrIdx`, `kontArrIdx` → `A` (array of `CH`-pool indices)
 */
type CompactDay = readonly [
	headerIdx: number,
	tone: number | null,
	fastIdx: number,
	commemArrIdx: number,
	tropArrIdx: number,
	kontArrIdx: number,
];

/** Pool of unique hymn tuples. Day records point into this via `tropArrIdx`
 *  and `kontArrIdx` → `A` → list of CH indices. */
const hymnPool = new Pool<CompactHymn>();
/** Pool of unique commemoration tuples. Day records point into this via
 *  `commemArrIdx` → `A` → list of CC indices. */
const commemPool = new Pool<CompactCommem>();
/** Shared pool of index arrays. Used by all three per-day lists
 *  (`commemorations`, `troparia`, `kontakia`). The empty array lives here
 *  too (interned once) so a day with no kontakia costs the same as any
 *  other day. */
const arrPool = new Pool<readonly number[]>();

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
function internHymn(h: EmittedHymn): number {
	const c = compactHymn(h);
	return hymnPool.intern(
		c,
		c[0] + "\x01" + c[1] + "\x01" + c[2] + "\x01" + c[3].join(","),
	);
}
function internCommem(c: EmittedCommemoration): number {
	const cc = compactCommem(c);
	return commemPool.intern(
		cc,
		cc[0] + "\x01" + cc[1] + "\x01" + cc[2] + "\x01" + cc[3].join(","),
	);
}
function internArr(ii: readonly number[]): number {
	return arrPool.intern(ii, ii.join(","));
}

const compactDays: (readonly [string, CompactDay])[] = sortedDates.map((iso) => {
	const f = emitted.get(iso)!;
	const cd: CompactDay = [
		headers.intern(f.headerText),
		f.tone,
		fasts.intern(f.fastText),
		internArr(f.commemorations.map(internCommem)),
		internArr(f.troparia.map(internHymn)),
		internArr(f.kontakia.map(internHymn)),
	];
	return [iso, cd];
});

/** Pool of unique inner propers-triplets `[commemArrIdx, tropArrIdx,
 *  kontArrIdx]`. ~40 % of days in the 3-year window share an identical
 *  triplet (same saint commemorations + same propers), e.g. 2025-01-01
 *  and 2026-01-01 both commemorate the Circumcision + St. Basil the Great
 *  with byte-identical propers; only the `[headerIdx, tone, fastIdx]`
 *  prefix differs between the two years. */
type InnerTriplet = readonly [number, number, number];
const triPool = new Pool<InnerTriplet>();
type CompactDayRow = readonly [headerIdx: number, tone: number | null, fastIdx: number, triIdx: number];
const dayRows: (readonly [string, CompactDayRow])[] = compactDays.map(([iso, cd]) => {
	const tri: InnerTriplet = [cd[3], cd[4], cd[5]];
	const triIdx = triPool.intern(tri, tri.join(","));
	return [iso, [cd[0], cd[1], cd[2], triIdx]];
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
	"// AUTO-GENERATED by scripts/codegen/day-facts.ts — do not edit by hand.",
	"// Source: scratch/htoc-days.json (scraped from holytrinityorthodox.com).",
	`// Generated: ${new Date().toISOString()}`,
	`// Years covered: ${raw.years.join(", ")}`,
	"",
	"/** A single HTOC-published hymn (troparion or kontakion) for one day. */",
	"export interface Hymn {",
	'\t/** Display title, e.g. `"Troparion, Tone IV"` or `"Holy Martyr Boniface"`. */',
	"\treadonly title: string;",
	'\t/** Hymn text. `"No Troparion is given for this service in the Menaion."` is',
	"\t *  used as a placeholder on days with no troparion for the ranked saint. */",
	"\treadonly text: string;",
	"\t/** Order-group as scraped from HTOC (used to recover display order on days",
	"\t *  with multiple saints). */",
	"\treadonly group: number;",
	"\t/** Saints this hymn is attached to. `slug` matches `Saint.slug` so a",
	"\t *  consumer can join propers to the day's commemoration list without any",
	"\t *  cId lookup. May be empty for day-level (resurrectional / feast) propers. */",
	"\treadonly saints: readonly { readonly name: string; readonly slug: string }[];",
	"}",
	"",
	"/** A single commemoration as printed on HTOC's day page: the authoritative",
	" *  user-facing list of saints / feasts / commemorations for the day, with",
	" *  HTOC's rank glyph and (optionally) life-page links. Superset of the",
	" *  navigable `Saint` list — includes New Hieromartyrs and other entries",
	" *  that have no life page and therefore no `cId` to join to Ponomar XML. */",
	"export interface Commemoration {",
	'\t/** HTOC rank glyph: `6` Great Feast / `4` Vigil-Polyeleos / `3` Doxology /',
	'\t *  `2` Six-stich / `1` Simple / `0` No sign / `o` Octoechos (weekday). */',
	"\treadonly rank: string;",
	"\t/** Display text as printed on the day page, with punctuation. */",
	"\treadonly text: string;",
	"\t/** `true` for minor commemorations grouped as a sub-bullet under a main entry. */",
	"\treadonly minor: boolean;",
	"\t/** Life-page links. `slug` matches `Saint.slug` when the commemoration",
	"\t *  has a life page in `saints.ts`; empty for entries without a life. */",
	"\treadonly lives: readonly { readonly name: string; readonly slug: string }[];",
	"}",
	"",
	"/** HTOC day-level facts: title line, tone, fast rule, commemoration list,",
	" *  and the day's propers. */",
	"export interface DayFacts {",
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
	"\treadonly commemorations: readonly Commemoration[];",
	"\t/** Day's troparia in HTOC publication order. */",
	"\treadonly troparia: readonly Hymn[];",
	"\t/** Day's kontakia in HTOC publication order. */",
	"\treadonly kontakia: readonly Hymn[];",
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

// ---------------------------------------------------------------------------
// Compact tuple pools
// ---------------------------------------------------------------------------
// Beyond the string pools, each unique hymn and commemoration *tuple*
// recurs across many days (the same saint's troparion is sung on his
// feast every year; the "Christ is Risen" paschal troparion is sung on
// 50+ days per year; the common forefeast commemorations repeat for a
// whole week). We intern each unique CH / CC tuple once into these
// pools and refer to it by integer index.
lines.push(
	"",
	"/** Pool of unique compact hymns `[titleIdx, textIdx, group, saintRefIdxs]`.",
	" *  Trop/kont lists reference entries here by integer index. */",
	"const CH: readonly (readonly [number, number, number, readonly number[]])[] = [",
);
for (const h of hymnPool.items) lines.push(`\t${JSON.stringify(h)},`);
lines.push("];", "");
lines.push(
	"/** Pool of unique compact commemorations `[rank, textIdx, minor01, livesRefIdxs]`.",
	" *  Commemoration lists reference entries here by integer index. */",
	"const CC: readonly (readonly [string, number, 0 | 1, readonly number[]])[] = [",
);
for (const c of commemPool.items) lines.push(`\t${JSON.stringify(c)},`);
lines.push("];", "");
lines.push(
	"/** Shared pool of index arrays. Day records reference `A[i]` with the",
	" *  interpretation determined by position: the `commemArrIdx` slot",
	" *  resolves `A[i]` as a list of `CC`-pool indices, while `tropArrIdx`",
	" *  and `kontArrIdx` resolve `A[i]` as a list of `CH`-pool indices. */",
	"const A: readonly (readonly number[])[] = [",
);
for (const a of arrPool.items) lines.push(`\t${JSON.stringify(a)},`);
lines.push("];", "");

lines.push(
	"/** Pool of unique propers-triplets `[commemArrIdx, tropArrIdx, kontArrIdx]`.",
	" *  See the comment on the codegen's `triPool`. */",
	"const T: readonly (readonly [number, number, number])[] = [",
);
for (const t of triPool.items) lines.push(`\t${JSON.stringify(t)},`);
lines.push("];", "");

lines.push(
	"/** Compact per-day row. `[headerIdx, tone, fastIdx, triIdx]` where",
	" *  `triIdx` indexes into `T` for the day's propers. Hydrated by `hyDay()`",
	" *  into the public `DayFacts` shape with no behavioral change. */",
	"type CD = readonly [number, number | null, number, number];",
	"",
	"const D: readonly (readonly [string, CD])[] = [",
);
for (const [iso, row] of dayRows) {
	lines.push(`\t[${JSON.stringify(iso)},${JSON.stringify(row)}],`);
}
lines.push(
	"];",
	"",
	"function hyHymn(i: number): Hymn {",
	"\tconst c = CH[i]!;",
	"\treturn {",
	"\t\ttitle: HT[c[0]]!,",
	"\t\ttext: HX[c[1]]!,",
	"\t\tgroup: c[2],",
	"\t\tsaints: c[3].map((j) => ({ name: R[j]![0], slug: R[j]![1] })),",
	"\t};",
	"}",
	"function hyCommem(i: number): Commemoration {",
	"\tconst c = CC[i]!;",
	"\treturn {",
	"\t\trank: c[0],",
	"\t\ttext: CT[c[1]]!,",
	"\t\tminor: c[2] === 1,",
	"\t\tlives: c[3].map((j) => ({ name: R[j]![0], slug: R[j]![1] })),",
	"\t};",
	"}",
	"function hyDay(c: CD): DayFacts {",
	"\tconst tri = T[c[3]]!;",
	"\treturn {",
	"\t\theaderText: H[c[0]]!,",
	"\t\ttone: c[1],",
	"\t\tfastText: F[c[2]]!,",
	"\t\tcommemorations: A[tri[0]]!.map(hyCommem),",
	"\t\ttroparia: A[tri[1]]!.map(hyHymn),",
	"\t\tkontakia: A[tri[2]]!.map(hyHymn),",
	"\t};",
	"}",
	"",
	"/** ISO-date → HTOC day facts for that day.",
	" *  Coverage: 2025-01-01 through 2027-12-31 (vendored corpus window). */",
	"export const DAY_FACTS_BY_ISO: ReadonlyMap<string, DayFacts> = new Map(",
	"\tD.map(([iso, cd]) => [iso, hyDay(cd)] as const),",
	");",
	"",
	`/** Total number of troparia entries across the vendored window. */`,
	`export const DAY_FACTS_TROPARIA_COUNT = ${totalTroparia};`,
	`/** Total number of kontakia entries across the vendored window. */`,
	`export const DAY_FACTS_KONTAKIA_COUNT = ${totalKontakia};`,
	`/** Total number of commemorations across the vendored window. */`,
	`export const DAY_FACTS_COMMEMORATIONS_COUNT = ${totalCommemorations};`,
	"",
);

writeFileSync(OUTPUT, lines.join("\n"), "utf8");
console.log(
	`wrote ${OUTPUT.replace(process.cwd(), "")} — ${emitted.size} days, ` +
		`${totalCommemorations} commemorations, ${totalTroparia} troparia, ` +
		`${totalKontakia} kontakia; pools: ` +
		`H=${headers.items.length} F=${fasts.items.length} ` +
		`HT=${hTitles.items.length} HX=${hTexts.items.length} ` +
		`CT=${cTexts.items.length} R=${refs.items.length} ` +
		`CH=${hymnPool.items.length} CC=${commemPool.items.length} ` +
		`A=${arrPool.items.length} T=${triPool.items.length}`,
);
