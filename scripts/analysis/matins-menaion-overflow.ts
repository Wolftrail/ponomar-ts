// Enumerate the 44 "matins / menaion" over-emissions: engine matins
// readings sourced from menaion data that HTOC itself doesn't publish
// in its matins bucket. Needed to decide the right suppression rule.

import type { CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { getOrderedMatinsReadings } from "../../src/engine/orderedMatins.ts";
import { getLiturgicalDay } from "../../src/engine/index.ts";
import type { ReadingRef } from "../../src/engine/readings.ts";
import { compareReadings } from "./comparators.ts";
import { iterCorpus } from "./corpus.ts";
import type { ScriptureReading } from "./corpus.ts";

function toCal(iso: string): CalendarDate {
	const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
	return { year: y!, month: m!, day: d! };
}

function pickMatins(day: readonly ScriptureReading[]): ScriptureReading[] {
	return day.filter((r) => /matins/i.test(r.note ?? ""));
}

interface Row {
	iso: string;
	dow: number;
	dRank: number;
	reading: string;
	type: string;
	cId: string;
	source: string;
	matinsBag: string;
	bag: string;
}

const rows: Row[] = [];

for (const { iso, day } of iterCorpus()) {
	const cal = toCal(iso);
	const litDay = getLiturgicalDay(cal);
	const matins = getOrderedMatinsReadings(cal);
	const engine: ReadingRef[] = [];
	for (const r of matins.refs) if (r.service === "matins") engine.push(r);
	// Filter to menaion-sourced only to match the overflow bucket.
	const menaion = engine.filter((r) => r.source === "menaion");
	if (menaion.length === 0) continue;
	const hBucket = pickMatins(day.scripture);
	const cmp = compareReadings(hBucket, menaion);
	for (const r of cmp.engineOnly) {
		rows.push({
			iso,
			dow: litDay.context.dow,
			dRank: litDay.dRank,
			reading: r.reading,
			type: r.type,
			cId: "", // compareReadings dropped it; look up below
			source: r.source,
			matinsBag: hBucket.map((h) => h.citation).join(" | ") || "(none)",
			bag: day.scripture.map((h) => `${h.citation}@${h.note ?? ""}`).join(" | "),
		});
	}
}

console.log(`\nTotal matins/menaion over-emissions: ${rows.length}\n`);

// By (dow, dRank) buckets.
const byDowRank = new Map<string, number>();
for (const r of rows) {
	const k = `dow=${r.dow} dRank=${r.dRank}`;
	byDowRank.set(k, (byDowRank.get(k) ?? 0) + 1);
}
console.log("By (dow, dRank):");
for (const [k, n] of [...byDowRank.entries()].sort((a, b) => b[1] - a[1])) {
	console.log(`  ${String(n).padStart(3)}  ${k}`);
}

// Per-ISO detail.
console.log("\nPer-date detail:");
for (const r of rows) {
	console.log(
		`  ${r.iso}  dow=${r.dow} dRank=${r.dRank}  ${r.reading} (${r.type})`,
	);
	console.log(`    HTOC matins bucket: ${r.matinsBag}`);
	console.log(`    HTOC all refs:      ${r.bag}`);
}
