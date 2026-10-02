// Codegen: reads `scratch/htoc-saints.json` (produced by the recon script)
// and emits `src/data/saints.ts` — a per-ISO-date lookup table of HTOC
// saint commemorations with rank glyphs, canonical URL, name list, and
// display text. Keyed by ISO date so lookups are trivially deterministic.
//
// Run:   node --experimental-strip-types scripts/codegen/saints.ts
// Reads: scratch/htoc-saints.json
// Emits: src/data/saints.ts

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	difference as diffG,
	type CalendarDate,
} from "../../src/core/calendar/pcalendar.ts";
import { fromGregorian } from "../../src/core/calendar/jdate.ts";
import { getOrthodoxPascha } from "../../src/paschalion.ts";

interface SaintRecord {
	readonly href: string;
	readonly cycle: "fixed" | "movable";
	readonly names: readonly string[];
	readonly ranks: readonly string[];
	readonly texts: readonly string[];
	readonly dates: readonly string[];
}

interface SaintsFile {
	readonly source: string;
	readonly years: readonly number[];
	readonly generatedAt: string;
	readonly count: number;
	readonly saints: readonly SaintRecord[];
}

const INPUT = resolve(process.cwd(), "scratch/htoc-saints.json");
const OUTPUT = resolve(process.cwd(), "src/data/saints.ts");

const raw = JSON.parse(readFileSync(INPUT, "utf8")) as SaintsFile;

interface EmittedEntry {
	readonly slug: string;
	readonly cycle: "fixed" | "movable";
	readonly names: readonly string[];
	readonly rank: string;
	readonly text: string;
}

const byDate = new Map<string, EmittedEntry[]>();
for (const s of raw.saints) {
	// Derive a stable per-canonical slug from the href tail.
	// `.../los/April/01-01.htm` → `April/01-01`
	// `.../los/Epiphany/e10121-...htm` → `Epiphany/e10121-...`
	const m = s.href.match(/\/los\/([^/]+\/[^.]+)/);
	const slug = m?.[1] ?? s.href;
	// Ranks & texts are position-aligned with names. Emit one entry per
	// canonical saint with the max rank glyph and first text.
	const rank = s.ranks[0] ?? "0";
	const text = s.texts[0] ?? "";
	const entry: EmittedEntry = {
		slug,
		cycle: s.cycle,
		names: s.names,
		rank,
		text,
	};
	for (const iso of s.dates) {
		let bucket = byDate.get(iso);
		if (bucket === undefined) {
			bucket = [];
			byDate.set(iso, bucket);
		}
		bucket.push(entry);
	}
}

const sortedDates = [...byDate.keys()].sort();

// ---------------------------------------------------------------------------
// Entry-level dedup
// ---------------------------------------------------------------------------
// HTOC's saint corpus is naturally cyclic: each canonical saint is
// commemorated on one Julian date (fixed cycle) or one Pascha-offset
// (movable cycle), so across the 3-year vendored window each distinct
// `EmittedEntry` appears on ~3 ISO dates. The previous emit inlined the
// full entry at every (iso, saint) row, duplicating ~2/3 of the bytes.
// We now intern each unique entry once into a shared pool and reference
// it from the per-day bucket by integer index. The public
// `SAINTS_BY_ISO: ReadonlyMap<string, readonly Saint[]>` keeps
// identical shape and values.

const entryIndex = new Map<string, number>();
const entryPool: EmittedEntry[] = [];
function internEntry(e: EmittedEntry): number {
	const key = e.slug + "\x01" + e.cycle + "\x01" + e.rank + "\x01" + e.text + "\x01" + e.names.join("\x02");
	const hit = entryIndex.get(key);
	if (hit !== undefined) return hit;
	const i = entryPool.length;
	entryIndex.set(key, i);
	entryPool.push(e);
	return i;
}

const compactByIso: (readonly [string, readonly number[]])[] = sortedDates.map((iso) => {
	const bucket = byDate.get(iso)!;
	return [iso, bucket.map(internEntry)] as const;
});

// ---------------------------------------------------------------------------
// Secondary string pools
// ---------------------------------------------------------------------------
// Beyond the entry-level dedup, individual fields of each unique entry
// repeat heavily across the pool: `text` strings are shared by the many
// Icon-of-the-Mother-of-God entries (one text, 2–13 name entries each),
// and `names` arrays are often a single common name (["John"] appears
// 54× in the pool). We intern these per-field once and reference them
// from a flat compact-entry tuple so the emitted `E` pool switches from
// object literals (with ~40 bytes of field-name boilerplate per row) to
// 5-tuple arrays. The public `Saint` shape is unchanged.

class StrPool {
	readonly items: string[] = [];
	private readonly idx = new Map<string, number>();
	intern(s: string): number {
		const hit = this.idx.get(s);
		if (hit !== undefined) return hit;
		const i = this.items.length;
		this.idx.set(s, i);
		this.items.push(s);
		return i;
	}
}
class NamesPool {
	readonly items: readonly string[][] = [];
	private readonly idx = new Map<string, number>();
	intern(ns: readonly string[]): number {
		const key = ns.join("\x02");
		const hit = this.idx.get(key);
		if (hit !== undefined) return hit;
		const i = this.items.length;
		this.idx.set(key, i);
		(this.items as string[][]).push([...ns]);
		return i;
	}
}
const txPool = new StrPool();
const naPool = new NamesPool();

/** Compact 5-tuple `[slug, cycleCode, namesIdx, rank, textIdx]` where
 *  `cycleCode` is 0 for `"fixed"` and 1 for `"movable"`. */
type CompactEntry = readonly [string, 0 | 1, number, string, number];
const compactEntries: CompactEntry[] = entryPool.map((e) => [
	e.slug,
	e.cycle === "fixed" ? 0 : 1,
	naPool.intern(e.names),
	e.rank,
	txPool.intern(e.text),
]);

const lines: string[] = [];
lines.push(
	"// AUTO-GENERATED by scripts/codegen/saints.ts — do not edit by hand.",
	"// Source: scratch/htoc-saints.json (scraped from holytrinityorthodox.com).",
	`// Generated: ${new Date().toISOString()}`,
	`// Years covered: ${raw.years.join(", ")}`,
	"",
	"/** A single HTOC saint commemoration for one ISO date. */",
	"export interface Saint {",
	'\t/** Stable slug derived from the HTOC URL, e.g. `"April/01-01"`. */',
	"\treadonly slug: string;",
	'\t/** `"fixed"` for menaion-cycle entries; `"movable"` for pentecostarion. */',
	'\treadonly cycle: "fixed" | "movable";',
	'\t/** Canonical name list, e.g. `["Basilides", "Geroncius"]`. */',
	"\treadonly names: readonly string[];",
	"\t/** HTOC rank glyph. Numeric strings (0..6) or `\"o\"` for un-graded. */",
	"\treadonly rank: string;",
	"\t/** Display text as scraped from HTOC. */",
	"\treadonly text: string;",
	"}",
	"",
	"// ---------------------------------------------------------------------------",
	"// Interned entries. Each canonical HTOC saint lives in `E` once as a",
	"// compact 5-tuple `[slug, cycleCode, namesIdx, rank, textIdx]`, with",
	"// `cycleCode` ∈ {0 = fixed, 1 = movable} and `namesIdx`/`textIdx`",
	"// indexing into the secondary `NA` / `TX` pools below. Per-day buckets",
	"// reference `E` entries by integer index. Rebuilt into the public",
	"// `Saint` object shape at module load by `hyEntry()`.",
	"// ---------------------------------------------------------------------------",
	"",
	"/** Pool of unique names arrays (one per interned saint entry). */",
	"const NA: readonly (readonly string[])[] = [",
);
for (const n of naPool.items) lines.push(`\t${JSON.stringify(n)},`);
lines.push("];", "");
lines.push(
	"/** Pool of unique display-text strings. */",
	"const TX: readonly string[] = [",
);
for (const t of txPool.items) lines.push(`\t${JSON.stringify(t)},`);
lines.push("];", "");
lines.push(
	"/** Compact entry pool. See the comment above. */",
	"type CE = readonly [string, 0 | 1, number, string, number];",
	"const E: readonly CE[] = [",
);
for (const ce of compactEntries) lines.push(`\t${JSON.stringify(ce)},`);
lines.push(
	"];",
	"",
	"function hyEntry(i: number): Saint {",
	"\tconst e = E[i]!;",
	"\treturn {",
	"\t\tslug: e[0],",
	"\t\tcycle: e[1] === 0 ? \"fixed\" : \"movable\",",
	"\t\tnames: NA[e[2]]!,",
	"\t\trank: e[3],",
	"\t\ttext: TX[e[4]]!,",
	"\t};",
	"}",
	"",
	"/** Compact per-day index: `[iso, entryIdxs]`. */",
	"const D: readonly (readonly [string, readonly number[]])[] = [",
);
for (const [iso, idxs] of compactByIso) {
	lines.push(`\t[${JSON.stringify(iso)}, ${JSON.stringify(idxs)}],`);
}
lines.push(
	"];",
	"",
	"/** ISO-date → HTOC saint commemorations for that day.",
	" *  Coverage: 2025-01-01 through 2027-12-31 (vendored corpus window). */",
	"export const SAINTS_BY_ISO: ReadonlyMap<string, readonly Saint[]> = new Map(",
	"\tD.map(([iso, idxs]) => [iso, idxs.map(hyEntry)] as const),",
	");",
	"",
	"/** Total number of (iso, saint) rows. */",
	`export const SAINTS_ROW_COUNT = ${raw.saints.reduce((n, s) => n + s.dates.length, 0)};`,
	"",
);

// ---------------------------------------------------------------------------
// Cycle decomposition
// ---------------------------------------------------------------------------
// The scraped per-ISO data has a cleaner structural factorization: each
// canonical saint belongs to one of two cycles —
//   fixed  → menaion (keyed by Julian month-day)
//   movable → pentecostarion (keyed by signed offset from Pascha)
// — and the few saints whose dates don't lie on a stable cycle key are
// listed as per-ISO exceptions. Together these three tables reproduce the
// full saint corpus for any Gregorian year, not just the vendored window.
//
// Measurements across 2025–2027 (see
// `scripts/analysis/saint-cycles-roundtrip.ts`):
//   • 2,291 of 2,295 fixed saints share a single Julian MM/DD across the
//     window (99.8%); 4 exceptions (forefeasts near Feb 29, Transfiguration
//     forefeast in Russian + Byzantine calendars).
//   • 27 of 36 movable saints share a single Pascha offset (75%); the
//     Apostles' Fast float accounts for the 9 exceptions.
//   • Cycle tables are set-equal to `SAINTS_BY_ISO` for all 1092 days
//     in the window; byte-identical for 1013 days (79 days differ only in
//     ordering of same-day saints — the ISO map preserves HTOC's scrape
//     order while the cycle tables use slug-sort).

const paschaCache = new Map<number, CalendarDate>();
function paschaFor(year: number): CalendarDate {
	let p = paschaCache.get(year);
	if (p === undefined) {
		p = getOrthodoxPascha(year);
		paschaCache.set(year, p);
	}
	return p;
}
function parseIso(iso: string): CalendarDate {
	return {
		year: +iso.slice(0, 4),
		month: +iso.slice(5, 7),
		day: +iso.slice(8, 10),
	};
}
/** Julian "MM-DD" for a Gregorian ISO date. */
function julianMd(iso: string): string {
	const j = fromGregorian(parseIso(iso));
	return `${String(j.month).padStart(2, "0")}-${String(j.day).padStart(2, "0")}`;
}
/** Days from Pascha (negative = before). */
function paschaOffset(iso: string): number {
	const g = parseIso(iso);
	return diffG(g, paschaFor(g.year));
}

const fixedCycle = new Map<string, number[]>();
const movableCycle = new Map<number, number[]>();
const cycleExceptions = new Map<string, number[]>();

// Build canonical-saint → encounter-order mapping from raw.saints iteration,
// then classify each by cycle stability across all its dates.
for (const s of raw.saints) {
	const m = s.href.match(/\/los\/([^/]+\/[^.]+)/);
	const slug = m?.[1] ?? s.href;
	const entry: EmittedEntry = {
		slug,
		cycle: s.cycle,
		names: s.names,
		rank: s.ranks[0] ?? "0",
		text: s.texts[0] ?? "",
	};
	const idx = internEntry(entry);

	if (s.cycle === "fixed") {
		const keys = new Set(s.dates.map(julianMd));
		if (keys.size === 1) {
			const k = keys.values().next().value as string;
			let bucket = fixedCycle.get(k);
			if (bucket === undefined) {
				bucket = [];
				fixedCycle.set(k, bucket);
			}
			bucket.push(idx);
		} else {
			for (const iso of s.dates) {
				let bucket = cycleExceptions.get(iso);
				if (bucket === undefined) {
					bucket = [];
					cycleExceptions.set(iso, bucket);
				}
				bucket.push(idx);
			}
		}
	} else {
		const offs = new Set(s.dates.map(paschaOffset));
		if (offs.size === 1) {
			const o = offs.values().next().value as number;
			let bucket = movableCycle.get(o);
			if (bucket === undefined) {
				bucket = [];
				movableCycle.set(o, bucket);
			}
			bucket.push(idx);
		} else {
			for (const iso of s.dates) {
				let bucket = cycleExceptions.get(iso);
				if (bucket === undefined) {
					bucket = [];
					cycleExceptions.set(iso, bucket);
				}
				bucket.push(idx);
			}
		}
	}
}

// Deterministic slug-sort within each cycle bucket.
const sortBySlug = (idxs: number[]): number[] =>
	[...idxs].sort((a, b) => entryPool[a]!.slug.localeCompare(entryPool[b]!.slug));
for (const k of [...fixedCycle.keys()]) fixedCycle.set(k, sortBySlug(fixedCycle.get(k)!));
for (const k of [...movableCycle.keys()]) movableCycle.set(k, sortBySlug(movableCycle.get(k)!));
for (const k of [...cycleExceptions.keys()]) cycleExceptions.set(k, sortBySlug(cycleExceptions.get(k)!));

const sortedFixedKeys = [...fixedCycle.keys()].sort();
const sortedMovableKeys = [...movableCycle.keys()].sort((a, b) => a - b);
const sortedExceptionKeys = [...cycleExceptions.keys()].sort();

lines.push(
	"// ---------------------------------------------------------------------------",
	"// Cycle tables (any-year lookup)",
	"// ---------------------------------------------------------------------------",
	"// `SAINTS_BY_ISO` above is bounded to the 3-year vendored window.",
	"// The tables below decompose the same corpus into three cycle layers so",
	"// callers can resolve saints for ANY Gregorian year:",
	"//   fixed    → keyed by Julian MM-DD (menaion cycle)",
	"//   movable  → keyed by Pascha offset in days (pentecostarion cycle)",
	"//   exceptions → keyed by ISO date for saints whose cycle key drifts",
	"//                (e.g. Transfiguration forefeast across Feb-29 years,",
	"//                 Apostles' Fast floats)",
	"// The three bucket contents are entry-pool indexes slug-sorted within",
	"// each key. Union = full saint list; order inside each cycle is",
	"// slug-ascending, concatenated fixed→movable→exceptions.",
	"",
	"/** Compact fixed-cycle map: `[julianMmDd, entryIdxs]`. */",
	"const CF: readonly (readonly [string, readonly number[]])[] = [",
);
for (const k of sortedFixedKeys) {
	lines.push(`\t[${JSON.stringify(k)}, ${JSON.stringify(fixedCycle.get(k))}],`);
}
lines.push(
	"];",
	"",
	"/** Compact movable-cycle map: `[paschaOffset, entryIdxs]`. */",
	"const CM: readonly (readonly [number, readonly number[]])[] = [",
);
for (const k of sortedMovableKeys) {
	lines.push(`\t[${k}, ${JSON.stringify(movableCycle.get(k))}],`);
}
lines.push(
	"];",
	"",
	"/** Compact per-ISO exception map for cycle-unstable saints. */",
	"const CX: readonly (readonly [string, readonly number[]])[] = [",
);
for (const k of sortedExceptionKeys) {
	lines.push(`\t[${JSON.stringify(k)}, ${JSON.stringify(cycleExceptions.get(k))}],`);
}
lines.push(
	"];",
	"",
	"/** Julian month-day (zero-padded `MM-DD`) → HTOC saints commemorated on",
	" *  that fixed-cycle date. Entries are slug-sorted. Use with `fromGregorian`",
	" *  from `core/calendar/jdate` to convert a civil Gregorian date to its",
	" *  Julian MM-DD key. Covers 364 Julian calendar days. */",
	"export const SAINT_FIXED_CYCLE: ReadonlyMap<string, readonly Saint[]> = new Map(",
	"\tCF.map(([k, idxs]) => [k, idxs.map(hyEntry)] as const),",
	");",
	"",
	"/** Signed days from Pascha (negative = before Pascha) → HTOC saints",
	" *  commemorated on that movable-cycle date. Entries are slug-sorted. */",
	"export const SAINT_MOVABLE_CYCLE: ReadonlyMap<number, readonly Saint[]> = new Map(",
	"\tCM.map(([k, idxs]) => [k, idxs.map(hyEntry)] as const),",
	");",
	"",
	"/** ISO date → HTOC saints whose cycle key drifts within the vendored",
	" *  window (e.g. Apostles' Fast floats, Feb-29 forefeasts). Union with",
	" *  the fixed+movable cycle lookups to get the full list for any day. */",
	"export const SAINT_EXCEPTIONS: ReadonlyMap<string, readonly Saint[]> = new Map(",
	"\tCX.map(([iso, idxs]) => [iso, idxs.map(hyEntry)] as const),",
	");",
	"",
);

writeFileSync(OUTPUT, lines.join("\n"), "utf8");
console.log(
	`wrote ${OUTPUT.replace(process.cwd(), "")} — ${byDate.size} dates, ` +
		`${raw.saints.length} canonical saints, ` +
		`${raw.saints.reduce((n, s) => n + s.dates.length, 0)} rows; ` +
		`entry pool: ${entryPool.length}; ` +
		`secondary pools: NA=${naPool.items.length} TX=${txPool.items.length}; ` +
		`cycle: ${fixedCycle.size} fixed keys, ${movableCycle.size} movable keys, ${cycleExceptions.size} exception days`,
);
