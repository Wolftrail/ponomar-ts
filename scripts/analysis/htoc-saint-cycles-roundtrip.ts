// Phase 5 prototype: decompose `HTOC_SAINTS_BY_ISO` into cycle tables
// (fixed-cycle Julian MM/DD, movable-cycle Pascha offset) + per-ISO
// exceptions, then round-trip reconstruct every day in the vendored window
// and prove exact equality against the current data. Not emitted — this is
// the correctness proof for the codegen that follows.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HTOC_SAINTS_BY_ISO } from "../../src/data/htocSaints.ts";
import type { HtocSaint } from "../../src/data/htocSaints.ts";
import { getOrthodoxPascha } from "../../src/paschalion.ts";
import { fromGregorian } from "../../src/core/calendar/jdate.ts";
import {
	addDays as addDaysG,
	difference as diffG,
	type CalendarDate,
} from "../../src/core/calendar/pcalendar.ts";

interface RawSaint {
	readonly href: string;
	readonly cycle: "fixed" | "movable";
	readonly names: readonly string[];
	readonly ranks: readonly string[];
	readonly texts: readonly string[];
	readonly dates: readonly string[];
}
interface RawFile {
	readonly saints: readonly RawSaint[];
}

const MONTHS = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
] as const;

function monthIndex(name: string): number {
	return MONTHS.indexOf(name as (typeof MONTHS)[number]) + 1;
}

/** Parse an ISO `YYYY-MM-DD` string into a Gregorian CalendarDate. */
function parseIso(iso: string): CalendarDate {
	return { year: +iso.slice(0, 4), month: +iso.slice(5, 7), day: +iso.slice(8, 10) };
}
/** Format Gregorian CalendarDate as `YYYY-MM-DD`. */
function toIso(d: CalendarDate): string {
	return `${String(d.year).padStart(4, "0")}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

const raw = JSON.parse(
	readFileSync(resolve(process.cwd(), "scratch/htoc-saints.json"), "utf8"),
) as RawFile;

// Build the same entry pool shape as rc.10 so each canonical saint has a
// single integer index.
function entryKey(e: Pick<HtocSaint, "slug" | "cycle" | "rank" | "text" | "names">): string {
	return `${e.slug}\x01${e.cycle}\x01${e.rank}\x01${e.text}\x01${e.names.join("\x02")}`;
}
function hrefSlug(href: string): string {
	return href.match(/\/los\/([^/]+\/[^.]+)/)?.[1] ?? href;
}

const entryIdx = new Map<string, number>();
const entries: HtocSaint[] = [];

/** Map canonical slug → (ISO date → entry index). Walks raw.saints
 *  and interns one entry per canonical saint. */
const saintToDates = new Map<string, { entry: number; dates: readonly string[]; cycle: "fixed" | "movable" }>();
for (const s of raw.saints) {
	const slug = hrefSlug(s.href);
	const entry: HtocSaint = {
		slug,
		cycle: s.cycle,
		names: s.names,
		rank: s.ranks[0] ?? "0",
		text: s.texts[0] ?? "",
	};
	const key = entryKey(entry);
	let idx = entryIdx.get(key);
	if (idx === undefined) {
		idx = entries.length;
		entryIdx.set(key, idx);
		entries.push(entry);
	}
	saintToDates.set(slug, { entry: idx, dates: s.dates, cycle: s.cycle });
}
console.log(`entry pool: ${entries.length} canonical saints`);

// ---------------------------------------------------------------------------
// Decomposition
// ---------------------------------------------------------------------------
// For each canonical saint, test whether its dates lie on a single cycle key:
//   fixed:   same Julian (MM, DD) for every date
//   movable: same (date − Pascha(year)) offset for every date
// If stable → add to FIXED or MOVABLE table. If not → add each (iso, entry)
// row to EXCEPTIONS so the ISO lookup still finds the saint on the exact
// scraped date.

type FixedKey = string; // "MM-DD" on the Julian calendar
const fixed = new Map<FixedKey, number[]>();
const movable = new Map<number, number[]>();
const exceptions = new Map<string, number[]>();

/** Julian (month, day) tuple for a Gregorian ISO date. */
function julianMD(iso: string): FixedKey {
	const g = parseIso(iso);
	const j = fromGregorian(g);
	return `${String(j.month).padStart(2, "0")}-${String(j.day).padStart(2, "0")}`;
}

const paschaCache = new Map<number, CalendarDate>();
function paschaFor(year: number): CalendarDate {
	let p = paschaCache.get(year);
	if (p === undefined) {
		p = getOrthodoxPascha(year);
		paschaCache.set(year, p);
	}
	return p;
}
/** Days from Pascha for a Gregorian ISO date (negative = before Pascha). */
function paschaOffset(iso: string): number {
	const g = parseIso(iso);
	return diffG(g, paschaFor(g.year));
}

let fixedStable = 0, fixedExcept = 0;
let movableStable = 0, movableExcept = 0;
for (const [slug, info] of saintToDates) {
	if (info.cycle === "fixed") {
		const keys = new Set(info.dates.map(julianMD));
		if (keys.size === 1) {
			const k = keys.values().next().value as string;
			let bucket = fixed.get(k);
			if (bucket === undefined) { bucket = []; fixed.set(k, bucket); }
			bucket.push(info.entry);
			fixedStable++;
		} else {
			for (const iso of info.dates) {
				let bucket = exceptions.get(iso);
				if (bucket === undefined) { bucket = []; exceptions.set(iso, bucket); }
				bucket.push(info.entry);
			}
			fixedExcept++;
		}
	} else {
		const offsets = new Set(info.dates.map(paschaOffset));
		if (offsets.size === 1) {
			const o = offsets.values().next().value as number;
			let bucket = movable.get(o);
			if (bucket === undefined) { bucket = []; movable.set(o, bucket); }
			bucket.push(info.entry);
			movableStable++;
		} else {
			for (const iso of info.dates) {
				let bucket = exceptions.get(iso);
				if (bucket === undefined) { bucket = []; exceptions.set(iso, bucket); }
				bucket.push(info.entry);
			}
			movableExcept++;
		}
	}
}
console.log(`fixed:   ${fixedStable} cycle-stable, ${fixedExcept} exceptions`);
console.log(`movable: ${movableStable} pascha-stable, ${movableExcept} exceptions`);
console.log(`fixed keys: ${fixed.size}, movable keys: ${movable.size}, exception days: ${exceptions.size}`);

// ---------------------------------------------------------------------------
// Reconstruction + round-trip
// ---------------------------------------------------------------------------
// For every ISO date in `HTOC_SAINTS_BY_ISO`, synthesize the saint list from
// FIXED(MM-DD) ∪ MOVABLE(paschaOffset) ∪ EXCEPTIONS(iso), sort by slug (to
// match HTOC's display order), and compare entry-set and ordering to the
// current `HTOC_SAINTS_BY_ISO` entry.

function reconstruct(iso: string): HtocSaint[] {
	const g = parseIso(iso);
	const fKey = julianMD(iso);
	const mKey = paschaOffset(iso);
	const idxs = new Set<number>();
	for (const i of fixed.get(fKey) ?? []) idxs.add(i);
	for (const i of movable.get(mKey) ?? []) idxs.add(i);
	for (const i of exceptions.get(iso) ?? []) idxs.add(i);
	return [...idxs]
		.map((i) => entries[i]!)
		.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Signature for an HtocSaint list, used only for equality comparison. */
function sig(list: readonly HtocSaint[]): string {
	return list.map((s) => `${s.slug}|${s.cycle}|${s.rank}|${s.text}|${s.names.join(",")}`).join("\n");
}

let ok = 0, bad = 0;
const mismatches: { iso: string; got: HtocSaint[]; want: readonly HtocSaint[] }[] = [];
for (const [iso, want] of HTOC_SAINTS_BY_ISO) {
	const got = reconstruct(iso);
	// Sort `want` by slug too for order-independent comparison. (We will
	// address order in the engine layer separately.)
	const wantSorted = [...want].sort((a, b) => a.slug.localeCompare(b.slug));
	if (sig(got) === sig(wantSorted)) ok++;
	else {
		bad++;
		if (mismatches.length < 5) mismatches.push({ iso, got, want: wantSorted });
	}
}
console.log();
console.log(`round-trip: ${ok} / ${ok + bad} days exact`);
if (bad > 0) {
	console.log("first mismatches:");
	for (const { iso, got, want } of mismatches) {
		const gotSet = new Set(got.map((s) => s.slug));
		const wantSet = new Set(want.map((s) => s.slug));
		const missing = [...wantSet].filter((s) => !gotSet.has(s));
		const extra = [...gotSet].filter((s) => !wantSet.has(s));
		console.log(` ${iso}: missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`);
	}
}

// Also measure the compact-table byte footprint.
function approxSize(): number {
	let n = 0;
	for (const [k, v] of fixed) n += k.length + 2 + v.length * 4;
	for (const [k, v] of movable) n += 4 + v.length * 4;
	for (const [k, v] of exceptions) n += k.length + 2 + v.length * 4;
	return n;
}
console.log(`approx cycle-table footprint (compact): ~${approxSize()} bytes`);
