// Recon script: extract HTOC's daily Liturgy Apostol+Gospel picks from the
// corpus fixtures and check if they key stably against `(ndayF, doy)`.
// If the key is stable across years for the same slot, we can build a
// deterministic override table. If not, we need a richer key.
//
// This is exploratory — output goes to stdout, not to a codegen file.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { computeDayContext } from "../../src/engine/day.ts";
import type { Corpus } from "./corpus.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES_DIR = resolve(HERE, "..", "..", "tests", "fixtures");
const YEARS = [2025, 2026, 2027] as const;

interface Reading {
	readonly citation: string;
	readonly note?: string;
}

interface Slot {
	readonly iso: string;
	readonly ndayF: number;
	readonly doy: number;
	readonly nday: number;
	readonly dow: number;
	readonly dRank: string;
	readonly readings: readonly Reading[];
}

/** Only keep "no-note" (or empty note) entries — those are the daily
 *  rjadovoje readings. Feasts / matins gospels / theotokos / etc. have
 *  explicit notes and are handled elsewhere. */
function isRjadovoje(r: Reading): boolean {
	const n = (r.note ?? "").trim();
	return n === "";
}

function loadCorpus(year: number): Corpus | null {
	const p = resolve(FIXTURES_DIR, `full-${year}.json`);
	if (!existsSync(p)) return null;
	return JSON.parse(readFileSync(p, "utf8")) as Corpus;
}

function isoToCal(iso: string): { year: number; month: number; day: number } {
	const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
	return { year: y!, month: m!, day: d! };
}

const slots: Slot[] = [];
for (const year of YEARS) {
	const c = loadCorpus(year);
	if (c === null) continue;
	for (const iso of Object.keys(c.days)) {
		const htoc = c.days[iso]!;
		const cal = isoToCal(iso);
		const ctx = computeDayContext(cal);
		const rjadovoje = htoc.scripture.filter(isRjadovoje);
		if (rjadovoje.length === 0) continue;
		slots.push({
			iso,
			ndayF: ctx.ndayF,
			doy: ctx.doy,
			nday: ctx.nday,
			dow: ctx.dow,
			dRank: htoc.commemorations[0]?.rank ?? "0",
			readings: rjadovoje.map((r) => ({
				citation: r.citation,
				...(r.note !== undefined && r.note.length > 0 ? { note: r.note } : {}),
			})),
		});
	}
}

// Group by (ndayF, doy). If the same key always yields the same readings,
// we have a stable table. Report collisions.
const byKey = new Map<string, Slot[]>();
for (const s of slots) {
	const k = `${s.ndayF}:${s.doy}`;
	const bucket = byKey.get(k) ?? [];
	bucket.push(s);
	byKey.set(k, bucket);
}

let stableKeys = 0;
let collisions = 0;
const collisionExamples: Array<{ key: string; slots: Slot[] }> = [];
for (const [k, bucket] of byKey.entries()) {
	if (bucket.length === 1) {
		stableKeys++;
		continue;
	}
	const first = bucket[0]!.readings.map((r) => r.citation).join(" | ");
	const allSame = bucket.every(
		(s) => s.readings.map((r) => r.citation).join(" | ") === first,
	);
	if (allSame) {
		stableKeys++;
	} else {
		collisions++;
		if (collisionExamples.length < 20) collisionExamples.push({ key: k, slots: bucket });
	}
}

console.log(`Total no-note slots: ${slots.length}`);
console.log(`Distinct (ndayF, doy) keys: ${byKey.size}`);
console.log(`Stable keys (same readings across years): ${stableKeys}`);
console.log(`Colliding keys (readings differ across years): ${collisions}`);

if (collisionExamples.length > 0) {
	console.log("\nCollision examples (first 20):");
	for (const c of collisionExamples) {
		console.log(`  key=${c.key}:`);
		for (const s of c.slots) {
			const rs = s.readings.map((r) => r.citation).join(" | ");
			console.log(
				`    ${s.iso}  nday=${s.nday}  dow=${s.dow}  → ${rs}`,
			);
		}
	}
}

// Also try alternate keys: (weeks-after-Pentecost, dow), (weeks-after-Pentecost, dow, isLeapAdjacent).
console.log("\n---");
console.log("Trying alternate key: (weeks-after-Pentecost, dow)");
const byPentecostKey = new Map<string, Slot[]>();
for (const s of slots) {
	// weeks-after-Pentecost: nday=49 is Pentecost. Weeks after = floor((nday-49)/7).
	// Handle negative (pre-Pascha) too.
	const wap = Math.floor((s.nday - 49) / 7);
	const k = `${wap}:${s.dow}`;
	const bucket = byPentecostKey.get(k) ?? [];
	bucket.push(s);
	byPentecostKey.set(k, bucket);
}
let wapStable = 0;
let wapCollisions = 0;
const wapCollisionExamples: Array<{ key: string; slots: Slot[] }> = [];
for (const [k, bucket] of byPentecostKey.entries()) {
	if (bucket.length === 1) {
		wapStable++;
		continue;
	}
	const first = bucket[0]!.readings.map((r) => r.citation).join(" | ");
	const allSame = bucket.every(
		(s) => s.readings.map((r) => r.citation).join(" | ") === first,
	);
	if (allSame) wapStable++;
	else {
		wapCollisions++;
		if (wapCollisionExamples.length < 15) wapCollisionExamples.push({ key: k, slots: bucket });
	}
}
console.log(`Distinct (wap, dow) keys: ${byPentecostKey.size}`);
console.log(`Stable: ${wapStable}, Collisions: ${wapCollisions}`);
if (wapCollisionExamples.length > 0) {
	console.log("\nCollision examples:");
	for (const c of wapCollisionExamples) {
		console.log(`  key=${c.key}:`);
		for (const s of c.slots) {
			const rs = s.readings.map((r) => r.citation).join(" | ");
			console.log(`    ${s.iso}  nday=${s.nday}  dRank=${s.dRank}  → ${rs}`);
		}
	}
}
