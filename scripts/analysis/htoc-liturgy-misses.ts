// Enumerate all Liturgy-bucket HTOC-only misses across the corpus so we
// can characterize the residual gap.

import type { CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { getOrderedLiturgyReadings } from "../../src/engine/orderedLiturgy.ts";
import { getOrderedMatinsReadings } from "../../src/engine/orderedMatins.ts";
import { getDailyReadings } from "../../src/engine/readings.ts";
import type { ReadingRef } from "../../src/engine/readings.ts";
import { compareReadings, readingRefMatchesCitation, tryParseCitation } from "./comparators.ts";
import { iterCorpus } from "./corpus.ts";
import type { HtocScriptureReading } from "./corpus.ts";

function bucketHtoc(note: string): "liturgy" | "matins" | "vespers" | "hour" {
	if (note === "") return "liturgy";
	if (/matins/i.test(note)) return "matins";
	if (/vespers?/i.test(note)) return "vespers";
	if (/\b(1st|3rd|6th|9th)\s+hour\b/i.test(note)) return "hour";
	return "liturgy";
}

function bucketEngine(r: ReadingRef): "liturgy" | "matins" | "vespers" | "hour" | "other" {
	if (r.service === "liturgy") return "liturgy";
	if (r.service === "matins") return "matins";
	if (r.service === "vespers") return "vespers";
	if (r.service === "primes" || r.service === "terce" || r.service === "sexte" || r.service === "none") return "hour";
	return "other";
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

interface Miss { iso: string; citation: string; note: string }
const misses: Miss[] = [];

for (const { iso, day } of iterCorpus()) {
	const cal = toCal(iso);
	const engineBag = collectEngineReadings(cal);
	const engineLiturgy = engineBag.filter((r) => bucketEngine(r) === "liturgy");
	// Great-Feast Matins gospels (Nativity, Theophany) are untagged in HTOC
	// and land in the Liturgy bucket; the engine emits them under `matins`
	// with type `"1".."11"` (Matins Gospel ordinal), not `"gospel"`.
	const engineMatinsGospels = engineBag.filter((r) => r.service === "matins" && /^(Mt|Mk|Lk|Jn)_/.test(r.reading));
	const htocLiturgy: HtocScriptureReading[] = [];
	for (const r of day.scripture) {
		if (bucketHtoc(r.note ?? "") === "liturgy") htocLiturgy.push(r);
	}
	const cmp = compareReadings(htocLiturgy, engineLiturgy);
	for (const m of cmp.htocOnly) {
		if (engineMatinsGospels.some((g) => readingRefMatchesCitation(g, m.citation))) {
			continue;
		}
		misses.push({ iso, citation: m.citation, note: m.note ?? "" });
	}
}

console.log(`Total Liturgy HTOC-only misses: ${misses.length}\n`);

// Group by note substring.
const byNote = new Map<string, Miss[]>();
for (const m of misses) {
	const key = m.note || "(no note)";
	if (!byNote.has(key)) byNote.set(key, []);
	byNote.get(key)!.push(m);
}
const sorted = [...byNote.entries()].sort((a, b) => b[1].length - a[1].length);
console.log("By note grouping (top 20):");
for (const [note, list] of sorted.slice(0, 20)) {
	console.log(`  ${list.length.toString().padStart(3)} × ${JSON.stringify(note)}`);
	for (const m of list) {
		console.log(`      • ${m.iso}  ${m.citation}`);
	}
}
