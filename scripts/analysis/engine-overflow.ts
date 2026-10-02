// Enumerate engine-only (over-emitted) refs across the HTOC corpus and
// group them so we can pick the biggest tractable suppression target.

import type { CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { getOrderedLiturgyReadings } from "../../src/engine/orderedLiturgy.ts";
import { getOrderedMatinsReadings } from "../../src/engine/orderedMatins.ts";
import { getDailyReadings } from "../../src/engine/readings.ts";
import type { ReadingRef } from "../../src/engine/readings.ts";
import { compareReadings, readingRefMatchesCitation } from "./comparators.ts";
import { iterCorpus } from "./corpus.ts";
import type { ScriptureReading } from "./corpus.ts";

type Bucket = "liturgy" | "matins" | "vespers" | "hour" | "other";

function bucketHtoc(note: string): "liturgy" | "matins" | "vespers" | "hour" {
	if (note === "") return "liturgy";
	if (/matins/i.test(note)) return "matins";
	if (/vespers?/i.test(note)) return "vespers";
	if (/\b(1st|3rd|6th|9th)\s+hour\b/i.test(note)) return "hour";
	return "liturgy";
}

function bucketEngine(r: ReadingRef): Bucket {
	if (r.service === "liturgy") return "liturgy";
	if (r.service === "matins") return "matins";
	if (r.service === "vespers") return "vespers";
	if (
		r.service === "primes" ||
		r.service === "terce" ||
		r.service === "sexte" ||
		r.service === "none"
	)
		return "hour";
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
		const k = `${r.source}|${r.type}|${r.service}|${r.reading}|${r.cId ?? ""}`;
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(r);
	}
	return out;
}

interface Over {
	iso: string;
	bucket: Bucket;
	reading: string;
	type: string;
	service: string;
	source: string;
}

const overs: Over[] = [];
const dayDeltas = new Map<string, number>();

for (const { iso, day } of iterCorpus()) {
	const cal = toCal(iso);
	const engineBag = collectEngineReadings(cal);
	const byBucket = new Map<Bucket, ScriptureReading[]>();
	for (const r of day.scripture) {
		const b = bucketHtoc(r.note ?? "");
		if (!byBucket.has(b)) byBucket.set(b, []);
		byBucket.get(b)!.push(r);
	}
	const engineByBucket = new Map<Bucket, ReadingRef[]>();
	for (const r of engineBag) {
		const b = bucketEngine(r);
		if (!engineByBucket.has(b)) engineByBucket.set(b, []);
		engineByBucket.get(b)!.push(r);
	}
	let dayDelta = 0;
	for (const b of ["liturgy", "matins", "vespers", "hour"] as const) {
		const h = byBucket.get(b) ?? [];
		const e = engineByBucket.get(b) ?? [];
		if (e.length === 0) continue;
		const cmp = compareReadings(h, e);
		// Rescue great-feast matins gospels that HTOC files untagged.
		const matinsGospels =
			b === "liturgy"
				? (engineByBucket.get("matins") ?? []).filter((r) =>
					/^(Mt|Mk|Lk|Jn)_/.test(r.reading),
				)
				: [];
		for (const r of cmp.engineOnly) {
			if (
				b === "liturgy" &&
				matinsGospels.some((g) =>
					readingRefMatchesCitation(g, r.reading),
				)
			) {
				continue;
			}
			overs.push({
				iso,
				bucket: b,
				reading: r.reading,
				type: r.type,
				service: r.service,
				source: r.source ?? "",
			});
			dayDelta++;
		}
	}
	if (dayDelta > 0) dayDeltas.set(iso, dayDelta);
}

console.log(`\nTotal engine-only refs across corpus: ${overs.length}\n`);

// By bucket.
console.log("By bucket:");
const byBucket = new Map<string, number>();
for (const o of overs) byBucket.set(o.bucket, (byBucket.get(o.bucket) ?? 0) + 1);
for (const [b, n] of [...byBucket.entries()].sort((a, b) => b[1] - a[1])) {
	console.log(`  ${String(n).padStart(4)}  ${b}`);
}

// By source.
console.log("\nBy source:");
const bySource = new Map<string, number>();
for (const o of overs) bySource.set(o.source, (bySource.get(o.source) ?? 0) + 1);
for (const [s, n] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
	console.log(`  ${String(n).padStart(4)}  ${s || "(unknown)"}`);
}

// By bucket x source.
console.log("\nBy bucket × source:");
const bySrcBucket = new Map<string, number>();
for (const o of overs) {
	const k = `${o.bucket} / ${o.source || "(unknown)"}`;
	bySrcBucket.set(k, (bySrcBucket.get(k) ?? 0) + 1);
}
for (const [k, n] of [...bySrcBucket.entries()].sort((a, b) => b[1] - a[1])) {
	console.log(`  ${String(n).padStart(4)}  ${k}`);
}

// Worst days.
console.log("\nTop 20 worst days by over-emission count:");
const sortedDays = [...dayDeltas.entries()].sort((a, b) => b[1] - a[1]);
for (const [iso, n] of sortedDays.slice(0, 20)) {
	const dayOvers = overs.filter((o) => o.iso === iso);
	console.log(`  ${iso}  (${n}): ${dayOvers.map((o) => `${o.bucket}:${o.reading}@${o.source}`).join("; ")}`);
}

// By (bucket, source) — days per group (recurring vs one-off).
console.log("\nDistinct source groups driving the overflow:");
const byCid = new Map<string, { count: number; sample: Over }>();
for (const o of overs) {
	const key = `${o.bucket}/${o.source}`;
	const existing = byCid.get(key);
	if (existing === undefined) byCid.set(key, { count: 1, sample: o });
	else existing.count++;
}
const topCids = [...byCid.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 25);
for (const [k, v] of topCids) {
	console.log(`  ${String(v.count).padStart(4)}  ${k.padEnd(32)}  example: ${v.sample.iso} ${v.sample.reading} (${v.sample.type})`);
}
