// Enumerate every aggregate (all-services) HTOC-reading only across the
// corpus, with per-day near-miss context: for each miss show the engine's
// refs on the same (book, chapter) so verse-range deltas are obvious.
//
// Run:  node --experimental-strip-types scripts/analysis/reading-misses.ts

import type { CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { getOrderedLiturgyReadings } from "../../src/engine/orderedLiturgy.ts";
import { getOrderedMatinsReadings } from "../../src/engine/orderedMatins.ts";
import { getDailyReadings } from "../../src/engine/readings.ts";
import type { ReadingRef } from "../../src/engine/readings.ts";
import { BibleRefError, parseBibleRef } from "../../src/bible/parse.ts";
import { compareReadings, tryParseCitation } from "./comparators.ts";
import { iterCorpus } from "./corpus.ts";

function toCal(iso: string): CalendarDate {
	const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
	return { year: y!, month: m!, day: d! };
}

function collectEngineReadings(cal: CalendarDate): ReadingRef[] {
	const bag: ReadingRef[] = [];
	const lit = getOrderedLiturgyReadings(cal);
	for (const r of lit.apostol) bag.push(r);
	for (const r of lit.gospel) bag.push(r);
	for (const r of lit.suppressed) bag.push(r);
	const matins = getOrderedMatinsReadings(cal);
	for (const r of matins.refs) bag.push(r);
	for (const r of matins.suppressed) bag.push(r);
	for (const service of ["vespers", "primes", "terce", "sexte", "none"] as const) {
		for (const r of getDailyReadings(cal, { service }).refs) bag.push(r);
	}
	const seen = new Set<string>();
	const out: ReadingRef[] = [];
	for (const r of bag) {
		const k = `${r.source}|${r.type}|${r.service}|${r.reading}`;
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(r);
	}
	return out;
}

interface NearMiss {
	readonly iso: string;
	readonly citation: string;
	readonly note: string;
	readonly book: string | null;
	readonly chapter: number | null;
	readonly engineBookChapterRefs: readonly string[];
}

const misses: NearMiss[] = [];

for (const { iso, day } of iterCorpus()) {
	const cal = toCal(iso);
	const engineBag = collectEngineReadings(cal);
	const cmp = compareReadings(day.scripture, engineBag);
	for (const m of cmp.only) {
		const parsed = tryParseCitation(m.citation);
		const book = parsed?.bookShort ?? null;
		const chapter = parsed?.chapter ?? null;
		const nearRefs: string[] = [];
		for (const r of engineBag) {
			try {
				const er = parseBibleRef(r.reading);
				if (book !== null && er.bookShort === book && er.chapter === chapter) {
					nearRefs.push(`${r.reading} (${r.service}/${r.type}, ${r.source})`);
				}
			} catch (e) {
				if (e instanceof BibleRefError) continue;
				throw e;
			}
		}
		misses.push({
			iso,
			citation: m.citation,
			note: m.note ?? "",
			book,
			chapter,
			engineBookChapterRefs: nearRefs,
		});
	}
}

console.log(`Aggregate reading only misses: ${misses.length}\n`);

// Group by (book, chapter) to surface recurring verse-range deltas.
const byKey = new Map<string, NearMiss[]>();
for (const m of misses) {
	const key = m.book === null ? "(unparseable)" : `${m.book} ${m.chapter}`;
	if (!byKey.has(key)) byKey.set(key, []);
	byKey.get(key)!.push(m);
}
const sortedKeys = [...byKey.entries()].sort((a, b) => b[1].length - a[1].length);

console.log("Grouped by (book, chapter):\n");
for (const [key, list] of sortedKeys) {
	console.log(`${list.length} × ${key}`);
	for (const m of list) {
		const note = m.note === "" ? "" : ` [${m.note}]`;
		console.log(`  ${m.iso}  ${m.citation}${note}`);
		if (m.engineBookChapterRefs.length === 0) {
			console.log(`    engine: (none on this book+chapter)`);
		} else {
			for (const er of m.engineBookChapterRefs) {
				console.log(`    engine: ${er}`);
			}
		}
	}
	console.log("");
}
