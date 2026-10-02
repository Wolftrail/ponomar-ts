// Categorize the HTOC vs. engine reading deltas so we can pick the biggest
// bucket to fix first. Reads `tests/fixtures/full-*.json`, runs the
// same reading comparator as `metrics.ts`, then classifies every only
// (readings the engine misses) and every engineOnly (readings the engine
// emits but HTOC omits) into a small set of service-context buckets. The
// classifier keys off the HTOC `note` field, which HTOC uses as the label
// beside each citation ("(6th Hour)", "Matins Gospel", "Vespers, 1st
// Reading", "Blessing of Waters, Epistle", ...).
//
// Outputs `scratch/htoc-reading-buckets.md`: per-bucket count + book Pareto
// + up to 8 representative example rows. This is the input for deciding
// which service the engine needs to start emitting next.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseBibleRef, BibleRefError } from "../../src/bible/parse.ts";
import type { CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { getOrderedLiturgyReadings } from "../../src/engine/orderedLiturgy.ts";
import { getOrderedMatinsReadings } from "../../src/engine/orderedMatins.ts";
import { getDailyReadings } from "../../src/engine/readings.ts";
import type { ReadingRef } from "../../src/engine/readings.ts";
import { compareReadings, tryParseCitation } from "./comparators.ts";
import { iterCorpus, SCRATCH_DIR } from "./corpus.ts";
import type { ScriptureReading } from "./corpus.ts";

/** Classify an HTOC `note` string into a coarse service-context bucket. */
function bucketNote(note: string | undefined): string {
	const n = (note ?? "").trim();
	if (n === "") return "default (no note)";
	if (/matins gospel/i.test(n)) {
		const m = /(\d+)(?:st|nd|rd|th)?\s+matins gospel/i.exec(n);
		if (m !== null) return `matins:gospel-of-eleven`;
		return "matins:gospel";
	}
	if (/6th hour/i.test(n)) return "hour:6th (Lent prophecy)";
	if (/3rd hour/i.test(n)) return "hour:3rd";
	if (/9th hour/i.test(n)) return "hour:9th";
	if (/royal hour/i.test(n)) return "hour:royal";
	if (/vespers.*1st\s*reading/i.test(n)) return "vespers:1st-reading";
	if (/vespers.*2nd\s*reading/i.test(n)) return "vespers:2nd-reading";
	if (/vespers.*\d+(?:st|nd|rd|th)?\s*reading/i.test(n)) return "vespers:nth-reading";
	if (/vespers.*gospel/i.test(n)) return "vespers:gospel";
	if (/blessing of waters/i.test(n)) return "blessing-of-waters";
	if (/^\(epistle\)?$/i.test(n) || /^\(?apostle\)?$/i.test(n)) return "liturgy:epistle-of-saint";
	if (/^\(gospel\)?$/i.test(n)) return "liturgy:gospel-of-saint";
	if (/theotokos/i.test(n)) return "theotokos";
	if (/departed/i.test(n)) return "departed";
	if (/forerunner/i.test(n)) return "forerunner";
	if (/(saints?|martyrs?|hieromartyr|venerable|apostles?)/i.test(n))
		return "liturgy:of-a-saint";
	if (/sunday after/i.test(n)) return "liturgy:sunday-after";
	return `other: ${n}`;
}

/** Classify an engine ref by service + type. Uses the same bucket vocabulary. */
function bucketEngineRef(r: ReadingRef): string {
	if (r.service === "matins" && r.type === "gospel") return "matins:gospel";
	if (r.service === "matins") return `matins:${r.type}`;
	if (r.service === "vespers" && r.type === "gospel") return "vespers:gospel";
	if (r.service === "vespers" && r.type === "1") return "vespers:1st-reading";
	if (r.service === "vespers" && r.type === "2") return "vespers:2nd-reading";
	if (r.service === "vespers") return `vespers:${r.type}`;
	if (r.service === "sexte") return "hour:6th (Lent prophecy)";
	if (r.service === "terce") return "hour:3rd";
	if (r.service === "none") return "hour:9th";
	if (r.service === "primes") return "hour:1st";
	if (r.service === "liturgy" && r.type === "apostol")
		return "liturgy:epistle-of-saint";
	if (r.service === "liturgy" && r.type === "gospel")
		return "liturgy:gospel-of-saint";
	return `other:${r.service}/${r.type}`;
}

function bookOfCitation(citation: string): string {
	const p = tryParseCitation(citation);
	return p?.book ?? "?";
}

function bookOfRef(reading: string): string {
	try {
		return parseBibleRef(reading).book;
	} catch (e) {
		if (e instanceof BibleRefError) return "?";
		throw e;
	}
}

interface BucketAcc {
	count: number;
	books: Map<string, number>;
	examples: string[];
}

function newBucketAcc(): BucketAcc {
	return { count: 0, books: new Map(), examples: [] };
}

function pushExample(acc: BucketAcc, line: string): void {
	if (acc.examples.length < 8) acc.examples.push(line);
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
	for (const service of [
		"liturgy",
		"matins",
		"vespers",
		"primes",
		"terce",
		"sexte",
		"none",
	] as const) {
		for (const r of getDailyReadings(cal, { service }).refs) bag.push(r);
	}
	const seen = new Set<string>();
	const out: ReadingRef[] = [];
	for (const r of bag) {
		const k = `${r.cId}|${r.type}|${r.service}|${r.reading}`;
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(r);
	}
	return out;
}

function isoToCal(iso: string): CalendarDate {
	const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
	return { year: y!, month: m!, day: d! };
}

function main(): void {
	if (!existsSync(SCRATCH_DIR)) mkdirSync(SCRATCH_DIR, { recursive: true });
	const onlyBuckets = new Map<string, BucketAcc>();
	const engineOnlyBuckets = new Map<string, BucketAcc>();

	let processed = 0;
	for (const { iso, day } of iterCorpus()) {
		const cal = isoToCal(iso);
		const engine = collectEngineReadings(cal);
		const res = compareReadings(day.scripture, engine);

		// only needs to look at the ORIGINAL ScriptureReading to
		// preserve note context, so we resolve indices post-hoc.
		const usedHtoc = new Set<ScriptureReading>();
		for (const missing of res.only) {
			usedHtoc.add(missing as ScriptureReading);
		}
		for (let i = 0; i < day.scripture.length; i++) {
			const r = day.scripture[i]!;
			if (!res.only.some((h) => h.citation === r.citation && h.note === r.note))
				continue;
			const bucket = bucketNote(r.note);
			let acc = onlyBuckets.get(bucket);
			if (acc === undefined) {
				acc = newBucketAcc();
				onlyBuckets.set(bucket, acc);
			}
			acc.count++;
			const book = bookOfCitation(r.citation);
			acc.books.set(book, (acc.books.get(book) ?? 0) + 1);
			pushExample(acc, `${iso}  ${r.citation}  [note: ${r.note ?? ""}]`);
		}

		for (const r of res.engineOnly) {
			// Recover the full engine ref to bucket properly.
			const full = engine.find(
				(e) =>
					e.source === r.source &&
					e.type === r.type &&
					e.service === r.service &&
					e.reading === r.reading,
			);
			if (full === undefined) continue;
			const bucket = bucketEngineRef(full);
			let acc = engineOnlyBuckets.get(bucket);
			if (acc === undefined) {
				acc = newBucketAcc();
				engineOnlyBuckets.set(bucket, acc);
			}
			acc.count++;
			const book = bookOfRef(full.reading);
			acc.books.set(book, (acc.books.get(book) ?? 0) + 1);
			pushExample(
				acc,
				`${iso}  ${full.reading}  [${full.source}/${full.type}/${full.service}]`,
			);
		}

		processed++;
		if (processed % 250 === 0)
			process.stdout.write(`  processed ${processed} days\n`);
	}

	const md: string[] = [];
	md.push("# HTOC ↔ engine reading buckets");
	md.push("");
	md.push(
		"Categorization of the ~1,278 HTOC-only + ~2,167 engine-only readings from",
	);
	md.push(
		"[scratch/htoc-metrics.md](metrics.md). Buckets are inferred from the HTOC `note` field",
	);
	md.push(
		"for HTOC-only, and from `(service, type)` for engine-only. Sorted by count.",
	);
	md.push("");
	md.push("## HTOC-only (engine is missing these)");
	md.push("");
	md.push("| bucket | count | top books |");
	md.push("| --- | ---: | --- |");
	const rows = [...onlyBuckets.entries()].sort(
		(a, b) => b[1].count - a[1].count,
	);
	for (const [bucket, acc] of rows) {
		const books = [...acc.books.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([b, c]) => `${b}(${c})`)
			.join(", ");
		md.push(`| \`${bucket}\` | ${acc.count} | ${books} |`);
	}
	md.push("");
	md.push("### HTOC-only examples per bucket");
	md.push("");
	for (const [bucket, acc] of rows) {
		md.push(`#### \`${bucket}\` (${acc.count} total)`);
		md.push("");
		md.push("```");
		for (const ex of acc.examples) md.push(ex);
		md.push("```");
		md.push("");
	}

	md.push("## Engine-only (HTOC does not list these)");
	md.push("");
	md.push("| bucket | count | top books |");
	md.push("| --- | ---: | --- |");
	const engineRows = [...engineOnlyBuckets.entries()].sort(
		(a, b) => b[1].count - a[1].count,
	);
	for (const [bucket, acc] of engineRows) {
		const books = [...acc.books.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([b, c]) => `${b}(${c})`)
			.join(", ");
		md.push(`| \`${bucket}\` | ${acc.count} | ${books} |`);
	}
	md.push("");
	md.push("### Engine-only examples per bucket");
	md.push("");
	for (const [bucket, acc] of engineRows) {
		md.push(`#### \`${bucket}\` (${acc.count} total)`);
		md.push("");
		md.push("```");
		for (const ex of acc.examples) md.push(ex);
		md.push("```");
		md.push("");
	}

	writeFileSync(
		resolve(SCRATCH_DIR, "reading-buckets.md"),
		`${md.join("\n")}\n`,
		"utf8",
	);
	process.stdout.write(
		`wrote scratch/htoc-reading-buckets.md — ${rows.length} only buckets, ${engineRows.length} engine-only buckets\n`,
	);
}

main();
