// Quick single-year reading-coverage report. Scoped to one year so we can
// re-verify an individual fixture (e.g. full-2026.json) didn't drift
// after an engine change. Mirrors the budgets in `tests/htoc.test.ts`
// but prints the raw numbers.

import type { CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { getOrderedLiturgyReadings } from "../../src/engine/orderedLiturgy.ts";
import { getOrderedMatinsReadings } from "../../src/engine/orderedMatins.ts";
import { getDailyReadings } from "../../src/engine/readings.ts";
import type { ReadingRef } from "../../src/engine/readings.ts";
import { compareReadings } from "./comparators.ts";
import { loadYear } from "./corpus.ts";

const YEAR = Number.parseInt(process.argv[2] ?? "2026", 10);
const corpus = loadYear(YEAR);

function toCal(iso: string): CalendarDate {
	const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
	return { year: y!, month: m!, day: d! };
}

function allEngineReadings(cal: CalendarDate): ReadingRef[] {
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
		const k = `${r.source}|${r.type}|${r.service}|${r.reading}`;
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(r);
	}
	return out;
}

let days = 0;
let totalHtoc = 0;
let totalEngine = 0;
let totalMatched = 0;
let totalOnly = 0;
let totalEngineOnly = 0;
let crashedDays = 0;

for (const iso of Object.keys(corpus.days)) {
	days++;
	const cal = toCal(iso);
	let engine: ReadingRef[];
	try {
		engine = allEngineReadings(cal);
	} catch (e) {
		crashedDays++;
		console.error(`CRASH on ${iso}: ${(e as Error).message}`);
		continue;
	}
	const htoc = corpus.days[iso]!.scripture;
	const cmp = compareReadings(htoc, engine);
	totalHtoc += cmp.count;
	totalEngine += cmp.engineCount;
	totalMatched += cmp.matched;
	totalOnly += cmp.only.length;
	totalEngineOnly += cmp.engineOnly.length;
}

const covered = totalHtoc === 0 ? 1 : totalMatched / totalHtoc;
const engineHit = totalEngine === 0 ? 1 : totalMatched / totalEngine;

console.log(`\n=== HTOC fixture: ${YEAR} (${days} days) ===`);
console.log(`  HTOC refs:        ${totalHtoc}`);
console.log(`  Engine refs:      ${totalEngine}`);
console.log(`  Matched:          ${totalMatched}`);
console.log(
	`  HTOC covered:     ${(covered * 100).toFixed(2)}%  (${totalOnly} missing)`,
);
console.log(
	`  Engine hit rate:  ${(engineHit * 100).toFixed(2)}%  (${totalEngineOnly} over-emit)`,
);
if (crashedDays > 0) {
	console.log(`  CRASHED DAYS:     ${crashedDays}`);
	process.exit(1);
}
