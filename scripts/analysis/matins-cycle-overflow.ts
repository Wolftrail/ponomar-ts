// Enumerate the 96 "matins / cycle" over-emissions — Sundays where the
// engine emits a resurrection matins gospel but HTOC omits it.

import type { CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { getOrderedMatinsReadings } from "../../src/engine/orderedMatins.ts";
import type { ReadingRef } from "../../src/engine/readings.ts";
import { getLiturgicalDay } from "../../src/engine/index.ts";
import { iterCorpus } from "./corpus.ts";
import type { ScriptureReading } from "./corpus.ts";

function toCal(iso: string): CalendarDate {
	const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
	return { year: y!, month: m!, day: d! };
}

interface Row {
	iso: string;
	dow: number;
	dRank: number;
	reading: string;
	hasMatins: boolean;
	matinsGospels: string[];
	topSaint: string;
}

const rows: Row[] = [];

for (const { iso, day } of iterCorpus()) {
	const cal = toCal(iso);
	const ld = getLiturgicalDay(cal);
	const matins = getOrderedMatinsReadings(cal);
	const cycleHits: ReadingRef[] = [];
	for (const r of matins.refs) {
		if (r.service === "matins" && r.source === "cycle") cycleHits.push(r);
	}
	for (const r of matins.suppressed) {
		if (r.service === "matins" && r.source === "cycle") cycleHits.push(r);
	}
	if (cycleHits.length === 0) continue;
	const matinsBag: ScriptureReading[] = [];
	const matinsGospels: string[] = [];
	for (const r of day.scripture) {
		const note = r.note ?? "";
		if (/matins/i.test(note)) {
			matinsBag.push(r);
			if (/gospel/i.test(note) || /^(Mt|Mk|Lk|Jn)\b/.test(r.citation)) {
				matinsGospels.push(r.citation);
			}
		}
	}
	for (const hit of cycleHits) {
		// Does HTOC list this cycle reading at matins?
		const found = matinsBag.some((h) => {
			const parts = h.citation.replace(/\s+/g, "");
			const eng = hit.reading.replace(/\s+/g, "");
			return parts === eng || h.citation.includes(hit.reading);
		});
		if (!found) {
			rows.push({
				iso,
				dow: ld.context.dow,
				dRank: ld.dRank,
				reading: hit.reading,
				hasMatins: matinsBag.length > 0,
				matinsGospels,
				topSaint: ld.allSaints[0]?.name?.nominative ?? "(none)",
			});
		}
	}
}

console.log(`\nTotal matins/cycle over-emissions: ${rows.length}\n`);

// Group by dRank
const byRank = new Map<number, Row[]>();
for (const r of rows) {
	if (!byRank.has(r.dRank)) byRank.set(r.dRank, []);
	byRank.get(r.dRank)!.push(r);
}
console.log("By dRank:");
for (const [rank, list] of [...byRank.entries()].sort((a, b) => b[1].length - a[1].length)) {
	console.log(`  dRank=${rank}: ${list.length}`);
}

// Group by (dow, hasMatins)
console.log("\nBy (dow, hasMatins):");
const byDowH = new Map<string, Row[]>();
for (const r of rows) {
	const k = `dow=${r.dow} hasMatins=${r.hasMatins}`;
	if (!byDowH.has(k)) byDowH.set(k, []);
	byDowH.get(k)!.push(r);
}
for (const [k, list] of [...byDowH.entries()].sort((a, b) => b[1].length - a[1].length)) {
	console.log(`  ${k}: ${list.length}`);
}

// Case A: HTOC has NO matins readings at all → engine over-emits cycle.
const noMatinsAtAll = rows.filter((r) => !r.hasMatins);
console.log(`\n== Case A: HTOC lists NO matins readings (${noMatinsAtAll.length}) ==`);
for (const r of noMatinsAtAll.slice(0, 25)) {
	console.log(`  ${r.iso} dow=${r.dow} dRank=${r.dRank}: engine emits ${r.reading}; top saint "${r.topSaint}"`);
}

// Case B: HTOC lists a DIFFERENT matins gospel → engine over-emits cycle.
const different = rows.filter((r) => r.hasMatins);
console.log(`\n== Case B: HTOC lists DIFFERENT matins (${different.length}) ==`);
for (const r of different.slice(0, 25)) {
	console.log(
		`  ${r.iso} dow=${r.dow} dRank=${r.dRank}: engine emits ${r.reading}; HTOC matins = [${r.matinsGospels.join(", ")}]; top saint "${r.topSaint}"`,
	);
}
