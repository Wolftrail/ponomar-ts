// Enumerate the "liturgy / htoc" over-emissions: HTOC-sourced readings
// the engine serves as liturgy, that HTOC itself doesn't publish in the
// liturgy bucket. These are prime suspects for codegen bucketing bugs.

import type { CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { getOrderedLiturgyReadings } from "../../src/engine/orderedLiturgy.ts";
import { getOrderedMatinsReadings } from "../../src/engine/orderedMatins.ts";
import { getDailyReadings } from "../../src/engine/readings.ts";
import type { ReadingRef } from "../../src/engine/readings.ts";
import { compareReadings, tryParseCitation } from "./comparators.ts";
import { iterCorpus } from "./corpus.ts";
import type { HtocScriptureReading } from "./corpus.ts";
import { parseBibleRef, BibleRefError } from "../../src/bible/parse.ts";
import type { BibleRef } from "../../src/bible/types.ts";

type Bucket = "liturgy" | "matins" | "vespers" | "hour";

function bucketHtoc(note: string): Bucket {
	if (note === "") return "liturgy";
	if (/matins/i.test(note)) return "matins";
	if (/vespers?/i.test(note)) return "vespers";
	if (/\b(1st|3rd|6th|9th)\s+hour\b/i.test(note)) return "hour";
	return "liturgy";
}

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

interface Miss {
	iso: string;
	engineReading: string;
	engineType: string;
	engineNote: string;
	htocNoteWhereFound: string | null;
	htocBucket: Bucket | null;
}

function keyOf(ref: BibleRef): string {
	if (ref.ranges.length === 0) return `${ref.book}|whole:${ref.chapter}`;
	const parts = ref.ranges.map(
		(r) => `${r.start.chapter}:${r.start.verse}-${r.end.chapter}:${r.end.verse}`,
	);
	return `${ref.book}|${parts.join(",")}`;
}

function tryKey(input: string, htoc = false): string | null {
	try {
		const ref = htoc ? tryParseCitation(input) : parseBibleRef(input);
		return ref === null ? null : keyOf(ref);
	} catch (e) {
		if (e instanceof BibleRefError) return null;
		throw e;
	}
}

const misses: Miss[] = [];

for (const { iso, day } of iterCorpus()) {
	const cal = toCal(iso);
	const engineBag = collectEngineReadings(cal);
	const engineLiturgy = engineBag.filter(
		(r) => r.service === "liturgy" && r.source === "htoc",
	);
	const htocLiturgy: HtocScriptureReading[] = [];
	for (const r of day.scripture) {
		if (bucketHtoc(r.note ?? "") === "liturgy") htocLiturgy.push(r);
	}
	const cmp = compareReadings(htocLiturgy, engineLiturgy);
	for (const r of cmp.engineOnly) {
		// Try to find this reading in HTOC's other buckets.
		const engineKey = tryKey(r.reading);
		let foundNote: string | null = null;
		let foundBucket: Bucket | null = null;
		for (const h of day.scripture) {
			const hKey = tryKey(h.citation, /*htoc*/ true);
			if (engineKey !== null && engineKey === hKey) {
				foundNote = h.note ?? "";
				foundBucket = bucketHtoc(foundNote);
				break;
			}
		}
		misses.push({
			iso,
			engineReading: r.reading,
			engineType: r.type,
			engineNote: "",
			htocNoteWhereFound: foundNote,
			htocBucket: foundBucket,
		});
	}
}

console.log(`\nTotal liturgy/htoc over-emissions: ${misses.length}\n`);

// Group by (htocBucket, htocNoteWhereFound).
const groups = new Map<string, Miss[]>();
for (const m of misses) {
	const key = m.htocBucket === null
		? `(not found in HTOC)`
		: `${m.htocBucket}: ${m.htocNoteWhereFound}`;
	if (!groups.has(key)) groups.set(key, []);
	groups.get(key)!.push(m);
}

console.log("Where does HTOC actually put these readings? Top 20 groups:");
const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [key, list] of sorted.slice(0, 20)) {
	console.log(`  ${String(list.length).padStart(4)}  ${key}`);
	for (const m of list.slice(0, 2)) {
		console.log(`        • ${m.iso}  ${m.engineReading}  (engineType=${m.engineType}, engineNote="${m.engineNote}")`);
	}
}
