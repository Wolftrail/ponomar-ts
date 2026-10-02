// Codegen for `src/data/saintLectionary.ts`.
//
// Extracts every *noted* HTOC scripture citation (i.e. `note !== ""`) from
// the corpus fixtures — Matins Gospels, saint-specific Liturgy readings,
// Vespers Old-Testament readings, Six-Hour prophecies, etc. — and emits a
// static TS module keyed by ISO date. Keyed by ISO (not `(ndayF, doy)`)
// because the saint calendar shifts on leap-year boundaries and Feb 29
// fires would collide otherwise. Runs manually via
//   node --experimental-strip-types scripts/codegen/saint-lectionary.ts

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BibleRef } from "../../src/bible/types.ts";
import { tryParseCitation } from "../analysis/comparators.ts";
import type { Corpus } from "../analysis/corpus.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES_DIR = resolve(HERE, "..", "..", "tests", "fixtures");
const OUT_PATH = resolve(
	HERE,
	"..",
	"..",
	"src",
	"data",
	"saintLectionary.ts",
);
const YEARS = [2025, 2026, 2027] as const;

const GOSPEL_BOOKS = new Set(["Mt", "Mk", "Lk", "Jn"]);

/** Format a parsed BibleRef as Ponomar-style "Short_C:V,V" using the
 *  canonical short book name (e.g. `"Heb_11:8, 16"`, not `"Hebrews_..."`). */
function ponomarStyle(ref: BibleRef): string {
	if (ref.ranges.length === 0) return `${ref.bookShort}_${ref.chapter}`;
	const parts = ref.ranges.map((r) => {
		const startSame = r.start.chapter === ref.chapter;
		const endSame = r.end.chapter === ref.chapter;
		const startChap = startSame ? "" : `${r.start.chapter}:`;
		const endChap = endSame ? "" : `${r.end.chapter}:`;
		const startPart = r.start.part ?? "";
		const endPart = r.end.part ?? "";
		const s = `${startChap}${r.start.verse}${startPart}`;
		const e = `${endChap}${r.end.verse}${endPart}`;
		return r.start.chapter === r.end.chapter && r.start.verse === r.end.verse
			? s
			: `${s}-${e}`;
	});
	return `${ref.bookShort}_${ref.chapter}:${parts.join(", ")}`;
}

/** Little-hour name; matches `HourName` in `src/engine/hours.ts`. */
type HourName = "prime" | "third" | "sixth" | "ninth";

/** Map hour ordinal to Ponomar's `ServiceContext` tag. */
const HOUR_TO_SERVICE: Readonly<Record<HourName, string>> = {
	prime: "primes",
	third: "terce",
	sixth: "sexte",
	ninth: "none",
};

/** Parse "1st Hour" / "3rd Hour" / "6th Hour" / "9th Hour" out of a
 *  free-text note, or `null` if none is present. */
function parseHour(note: string): HourName | null {
	const m = /\b(1st|3rd|6th|9th)\s+hour\b/i.exec(note);
	if (m === null) return null;
	switch (m[1]!.toLowerCase()) {
		case "1st":
			return "prime";
		case "3rd":
			return "third";
		case "6th":
			return "sixth";
		case "9th":
			return "ninth";
	}
	return null;
}

/** Classify an HTOC `note` string into a `(service, type, hour?)` triple.
 *  `service` uses Ponomar's `ServiceContext` vocabulary directly so hour
 *  readings feed the same `getDailyReadings({ service: "sexte" })` filter
 *  as upstream Ezekiel prophecies. `hour` is set only when the note names
 *  a specific Little Hour (all four Royal-Hours variants + Lenten 6th). */
function classifyNote(
	note: string,
	book: string,
): { service: string; type: string; hour?: HourName } {
	// Matins Gospels: numbered ("(4th Matins Gospel)") or plain.
	if (/matins/i.test(note)) return { service: "matins", type: "gospel" };
	// Vespers Old-Testament + New-Testament readings.
	if (/vespers?/i.test(note)) {
		return { service: "vespers", type: "reading" };
	}
	// Hours must name a specific hour to route to the little-hour bucket;
	// "Royal Martyrs" (July 17) intentionally does not match.
	const hour = parseHour(note);
	if (hour !== null) {
		return { service: HOUR_TO_SERVICE[hour], type: "reading", hour };
	}
	// Explicit type markers in the note.
	if (/\bepistle\b/i.test(note) || /\bapostle\b/i.test(note)) {
		return { service: "liturgy", type: "apostol" };
	}
	if (/\bgospel\b/i.test(note)) {
		return { service: "liturgy", type: "gospel" };
	}
	// Fall through: derive from the book. Gospel books → gospel;
	// everything else → apostol; assumed Liturgy service.
	const type: "apostol" | "gospel" = GOSPEL_BOOKS.has(book)
		? "gospel"
		: "apostol";
	return { service: "liturgy", type };
}

function loadCorpus(year: number): Corpus | null {
	const p = resolve(FIXTURES_DIR, `full-${year}.json`);
	if (!existsSync(p)) return null;
	return JSON.parse(readFileSync(p, "utf8")) as Corpus;
}

interface Entry {
	readonly service: string;
	readonly type: string;
	readonly reading: string;
	readonly note: string;
	readonly hour?: HourName;
}

const byIso = new Map<string, Entry[]>();
let totalNoted = 0;
let skippedUnparseable = 0;

for (const year of YEARS) {
	const c = loadCorpus(year);
	if (c === null) continue;
	for (const iso of Object.keys(c.days)) {
		const day = c.days[iso]!;
		const entries: Entry[] = [];
		for (const s of day.scripture) {
			const note = (s.note ?? "").trim();
			if (note === "") continue;
			totalNoted++;
			const parsed = tryParseCitation(s.citation);
			if (parsed === null) {
				skippedUnparseable++;
				continue;
			}
			const classification = classifyNote(note, parsed.book);
			entries.push({
				service: classification.service,
				type: classification.type,
				reading: ponomarStyle(parsed),
				note,
				...(classification.hour !== undefined
					? { hour: classification.hour }
					: {}),
			});
		}
		if (entries.length > 0) byIso.set(iso, entries);
	}
}

const sortedIsos = [...byIso.keys()].sort();

// --- Pool: intern each unique (service, type, reading, note, hour) tuple. ---
function sigOf(e: Entry): string {
	return `${e.service}\u0001${e.type}\u0001${e.reading}\u0001${e.note}\u0001${e.hour ?? ""}`;
}
const poolIndex = new Map<string, number>();
const pool: Entry[] = [];
for (const iso of sortedIsos) {
	for (const e of byIso.get(iso)!) {
		const s = sigOf(e);
		if (!poolIndex.has(s)) {
			poolIndex.set(s, -1);
			pool.push(e);
		}
	}
}
// Deterministic order: service, type, hour, reading, note.
pool.sort((a, b) => {
	if (a.service !== b.service) return a.service < b.service ? -1 : 1;
	if (a.type !== b.type) return a.type < b.type ? -1 : 1;
	const ah = a.hour ?? "";
	const bh = b.hour ?? "";
	if (ah !== bh) return ah < bh ? -1 : 1;
	if (a.reading !== b.reading) return a.reading < b.reading ? -1 : 1;
	return a.note < b.note ? -1 : a.note > b.note ? 1 : 0;
});
poolIndex.clear();
for (let i = 0; i < pool.length; i++) poolIndex.set(sigOf(pool[i]!), i);

const totalRows = sortedIsos.reduce((n, iso) => n + byIso.get(iso)!.length, 0);

const lines: string[] = [];
lines.push(
	"// AUTO-GENERATED by scripts/codegen/saint-lectionary.ts.",
	"// Do not hand-edit. Regenerate via",
	"//   node --experimental-strip-types scripts/codegen/saint-lectionary.ts",
	"//",
	"// Storage layout: entries are interned into a single pool `E`; each day",
	"// row stores integer indices into `E`, roughly a 4\u00D7 size reduction",
	"// vs. the fully-inlined form while preserving the exported Map's",
	"// identity and ordering byte-for-byte.",
	"",
	'import type { HourName } from "../engine/hours.ts";',
	"",
	"/** A single HTOC noted scripture reading for one ISO date. */",
	"export interface SaintLectionaryEntry {",
	'\t/** Service bucket: matches Ponomar `ServiceContext` — one of',
	'\t *  `"matins" | "liturgy" | "vespers" | "primes" | "terce" | "sexte" | "none"`. */',
	"\treadonly service: string;",
	'\t/** Reading type: `"apostol" | "gospel" | "reading"`. */',
	"\treadonly type: string;",
	'\t/** Ponomar-style short-book citation, e.g. `"Heb_11:8, 16"`. */',
	"\treadonly reading: string;",
	"\t/** Original HTOC `note` field verbatim, for downstream disambiguation. */",
	"\treadonly note: string;",
	"\t/** Little Hour this reading is prescribed for (Royal Hours name a specific",
	"\t *  hour; Lenten 6th-hour prophecies map to `sixth`). Absent when the note",
	"\t *  doesn't name an hour. */",
	"\treadonly hour?: HourName;",
	"}",
	"",
	`// ${pool.length} unique (service, type, reading, note, hour) tuples interned here.`,
	"const E: readonly SaintLectionaryEntry[] = [",
);
for (const e of pool) {
	const parts = [
		`service: ${JSON.stringify(e.service)}`,
		`type: ${JSON.stringify(e.type)}`,
		`reading: ${JSON.stringify(e.reading)}`,
		`note: ${JSON.stringify(e.note)}`,
	];
	if (e.hour !== undefined) parts.push(`hour: ${JSON.stringify(e.hour)}`);
	lines.push(`\t{ ${parts.join(", ")} },`);
}
lines.push(
	"];",
	"",
	"// Compact per-day table: `[iso, [entryIdx, ...]]`.",
	"const D: readonly (readonly [string, readonly number[]])[] = [",
);
for (const iso of sortedIsos) {
	const idxs = byIso.get(iso)!.map((e) => poolIndex.get(sigOf(e))!).join(",");
	lines.push(`\t[${JSON.stringify(iso)}, [${idxs}]],`);
}
lines.push(
	"];",
	"",
	"/** ISO-date → noted HTOC scripture readings for that day.",
	" *  Coverage: 2025-01-01 through 2027-12-31 (vendored corpus window). */",
	"export const SAINT_LECTIONARY: ReadonlyMap<string, readonly SaintLectionaryEntry[]> = new Map(",
	"\tD.map(([iso, ii]) => [iso, ii.map((i) => E[i]!)] as const),",
	");",
	"",
	`export const SAINT_LECTIONARY_SIZE = ${byIso.size};`,
	`export const SAINT_LECTIONARY_ROWS = ${totalRows};`,
	"",
);

writeFileSync(OUT_PATH, lines.join("\n"), "utf8");
console.log(
	`wrote ${OUT_PATH.replace(process.cwd(), "")} — ${byIso.size} dates, ${pool.length} unique entries pooled (${totalNoted} noted refs total, ${skippedUnparseable} unparseable skipped)`,
);
