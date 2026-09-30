// One-shot Liturgy-only coverage report. Buckets HTOC readings into
// (liturgy | matins | vespers | hour | other) using the same note-based
// classifier as the codegen, buckets engine refs by their `service` tag,
// then compares each bucket independently.

import type { CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { getOrderedLiturgyReadings } from "../../src/engine/orderedLiturgy.ts";
import { getOrderedMatinsReadings } from "../../src/engine/orderedMatins.ts";
import { getDailyReadings } from "../../src/engine/readings.ts";
import type { ReadingRef } from "../../src/engine/readings.ts";
import { compareReadings, readingRefMatchesCitation, tryParseCitation } from "./comparators.ts";
import { iterCorpus } from "./corpus.ts";
import type { HtocScriptureReading } from "./corpus.ts";

const GOSPEL_BOOKS = new Set(["Mt", "Mk", "Lk", "Jn"]);

type Bucket = "liturgy" | "matins" | "vespers" | "hour" | "other";

/** Mirror of `scripts/codegen/htoc-saint-lectionary.ts::classifyNote` but
 *  returns just the bucket. `""` (empty note) defaults to Liturgy since
 *  every non-noted HTOC citation is a rjadovoje Liturgy reading. */
function bucketHtoc(note: string, book: string): Bucket {
	if (note === "") return "liturgy";
	if (/matins/i.test(note)) return "matins";
	if (/vespers?/i.test(note)) return "vespers";
	if (/\b(1st|3rd|6th|9th)\s+hour\b/i.test(note)) return "hour";
	if (/\bepistle\b/i.test(note) || /\bapostle\b/i.test(note)) return "liturgy";
	if (/\bgospel\b/i.test(note)) return "liturgy";
	// Fallback: saint / feast / plain — Liturgy.
	void book;
	return "liturgy";
}

function bucketEngine(r: ReadingRef): Bucket {
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

interface Totals {
	matched: number;
	htocOnly: number;
	engineOnly: number;
}
function newTotals(): Totals { return { matched: 0, htocOnly: 0, engineOnly: 0 }; }

const perBucket: Record<Bucket, Totals> = {
	liturgy: newTotals(),
	matins: newTotals(),
	vespers: newTotals(),
	hour: newTotals(),
	other: newTotals(),
};

let days = 0;
const worstLiturgyDays: Array<{ iso: string; delta: number; htocOnly: number; engineOnly: number }> = [];

for (const { iso, day } of iterCorpus()) {
	days++;
	const cal = toCal(iso);
	const engineBag = collectEngineReadings(cal);
	// Partition HTOC scriptures into buckets.
	const htocByBucket = new Map<Bucket, HtocScriptureReading[]>();
	for (const r of day.scripture) {
		const parsed = tryParseCitation(r.citation);
		const book = parsed?.bookShort ?? "";
		const b = bucketHtoc(r.note ?? "", book);
		if (!htocByBucket.has(b)) htocByBucket.set(b, []);
		htocByBucket.get(b)!.push(r);
	}
	const engineByBucket = new Map<Bucket, ReadingRef[]>();
	for (const r of engineBag) {
		const b = bucketEngine(r);
		if (!engineByBucket.has(b)) engineByBucket.set(b, []);
		engineByBucket.get(b)!.push(r);
	}
	for (const b of ["liturgy", "matins", "vespers", "hour", "other"] as const) {
		const h = htocByBucket.get(b) ?? [];
		const e = engineByBucket.get(b) ?? [];
		if (h.length === 0 && e.length === 0) continue;
		const cmp = compareReadings(h, e);
		let matched = cmp.matched;
		let htocOnly = cmp.htocOnly.length;
		if (b === "liturgy" && cmp.htocOnly.length > 0) {
			// Rescue Great-Feast Matins gospels HTOC leaves untagged; engine
			// tags them with a Matins Gospel ordinal (`"1".."11"`), not `"gospel"`.
			const matinsGospels = (engineByBucket.get("matins") ?? []).filter((r) => /^(Mt|Mk|Lk|Jn)_/.test(r.reading));
			for (const m of cmp.htocOnly) {
				if (matinsGospels.some((g) => readingRefMatchesCitation(g, m.citation))) {
					matched++;
					htocOnly--;
				}
			}
		}
		perBucket[b].matched += matched;
		perBucket[b].htocOnly += htocOnly;
		perBucket[b].engineOnly += cmp.engineOnly.length;
		if (b === "liturgy") {
			const delta = htocOnly + cmp.engineOnly.length;
			if (delta > 0) {
				worstLiturgyDays.push({
					iso,
					delta,
					htocOnly,
					engineOnly: cmp.engineOnly.length,
				});
			}
		}
	}
}

worstLiturgyDays.sort((a, b) => b.delta - a.delta);

console.log(`\nHTOC Liturgy-scoped coverage — ${days} days\n`);
console.log("Bucket    | matched | htocOnly | engineOnly | coverage%");
console.log("--------- | ------: | -------: | ---------: | --------:");
for (const b of ["liturgy", "matins", "vespers", "hour", "other"] as const) {
	const t = perBucket[b];
	const denom = t.matched + t.htocOnly;
	const pct = denom === 0 ? "  n/a" : `${((t.matched / denom) * 100).toFixed(2)}%`;
	console.log(`${b.padEnd(9)} | ${String(t.matched).padStart(7)} | ${String(t.htocOnly).padStart(8)} | ${String(t.engineOnly).padStart(10)} | ${pct.padStart(9)}`);
}

console.log(`\nTop 15 worst Liturgy-bucket days by delta:`);
console.log("iso        | htocOnly | engineOnly");
console.log("---------- | -------: | ---------:");
for (const d of worstLiturgyDays.slice(0, 15)) {
	console.log(`${d.iso} | ${String(d.htocOnly).padStart(8)} | ${String(d.engineOnly).padStart(10)}`);
}
