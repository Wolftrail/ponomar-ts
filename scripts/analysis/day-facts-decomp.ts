// Analysis: measure how cleanly `dayFacts` decomposes into a fixed
// (Julian MM-DD) cycle and a movable (Pascha-offset) cycle, using the
// 3-year vendored window (2025–2027) as empirical cross-validation.
//
// For each day in the window we group it by:
//   fixedKey   = Julian MM-DD of its Gregorian date
//   movableKey = (date − Orthodox Pascha of that civil year) in days
//
// Then for every (fixedKey, field) and (movableKey, field) group we check
// whether all occurrences in the 3-year window carry the same value.
// Fields checked:
//   movable candidates: headerText, tone, fastText
//   fixed candidates:   commemorations, troparia-with-saints, kontakia-with-saints
//   mixed:              troparia-no-saints, kontakia-no-saints  (expected movable)
//
// Prints:
//   • per-field consistency rate across keys
//   • number of unique keys vs number of inconsistent keys
//   • a worked example of one inconsistent fixed-key, if any

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	difference as diffG,
	type CalendarDate,
} from "../../src/core/calendar/pcalendar.ts";
import { fromGregorian } from "../../src/core/calendar/jdate.ts";
import { getOrthodoxPascha } from "../../src/paschalion.ts";

interface RawHymn {
	readonly title: string;
	readonly text: string;
	readonly group: number;
	readonly saints: readonly { readonly name: string; readonly href: string }[];
}
interface RawDay {
	readonly headerText: string;
	readonly tone: number | string;
	readonly fastText: string;
	readonly troparia: readonly RawHymn[];
	readonly kontakia: readonly RawHymn[];
}
interface RawCommemoration {
	readonly rank: string;
	readonly text: string;
	readonly minor: boolean;
	readonly lives: readonly { readonly name: string; readonly href: string }[];
}
interface FixtureFile {
	readonly days: Readonly<Record<string, { readonly commemorations: readonly RawCommemoration[] }>>;
}

const DAYS = JSON.parse(
	readFileSync(resolve("scratch/htoc-days.json"), "utf8"),
) as { readonly days: Readonly<Record<string, RawDay>> };
const FIXTURE_YEARS = [2025, 2026, 2027] as const;
const commemorations = new Map<string, readonly RawCommemoration[]>();
for (const y of FIXTURE_YEARS) {
	const fx = JSON.parse(
		readFileSync(resolve(`tests/fixtures/htoc-full-${y}.json`), "utf8"),
	) as FixtureFile;
	for (const [iso, day] of Object.entries(fx.days)) {
		commemorations.set(iso, day.commemorations ?? []);
	}
}

function parseIso(iso: string): CalendarDate {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	return { year: y, month: m, day: d };
}
function fixedKey(iso: string): string {
	const g = parseIso(iso);
	const j = fromGregorian(g);
	return `${String(j.month).padStart(2, "0")}-${String(j.day).padStart(2, "0")}`;
}
/** Movable key. The Pentecost tone/header cycle is controlled by the most
 *  recent Pascha ≤ this date, i.e. for dates before this civil year's
 *  Pascha the "controlling" Pascha is the previous year's. Within a single
 *  liturgical year (controlling-Pascha → next-controlling-Pascha−1 days)
 *  the cycle is unambiguous. */
function movableKey(iso: string): number {
	const g = parseIso(iso);
	const thisPascha = getOrthodoxPascha(g.year);
	const delta = diffG(g, thisPascha);
	if (delta >= 0) return delta;
	const prevPascha = getOrthodoxPascha(g.year - 1);
	return diffG(g, prevPascha);
}

type Field = {
	readonly name: string;
	readonly cycle: "fixed" | "movable";
	readonly value: (iso: string, d: RawDay) => string;
};

/** Pull just the saint-attached hymns (likely fixed-cycle). */
function withSaints(h: readonly RawHymn[]): readonly RawHymn[] {
	return h.filter((x) => x.saints.length > 0);
}
/** Pull just the day-level hymns (likely movable-cycle). */
function noSaints(h: readonly RawHymn[]): readonly RawHymn[] {
	return h.filter((x) => x.saints.length === 0);
}
function hymnKey(h: RawHymn): string {
	return `${h.title}\u0001${h.text}\u0001${h.group}\u0001${h.saints.map((s) => s.name + "/" + s.href).join("\u0002")}`;
}
function hymnsKey(hs: readonly RawHymn[]): string {
	return hs.map(hymnKey).join("\u0003");
}
function commemKey(cs: readonly RawCommemoration[]): string {
	return cs
		.map(
			(c) =>
				`${c.rank}\u0001${c.text}\u0001${c.minor ? 1 : 0}\u0001${c.lives
					.map((l) => l.name + "/" + l.href)
					.join("\u0002")}`,
		)
		.join("\u0003");
}

const fields: readonly Field[] = [
	{ name: "headerText", cycle: "movable", value: (_i, d) => d.headerText ?? "" },
	{ name: "tone", cycle: "movable", value: (_i, d) => String(d.tone) },
	{ name: "fastText", cycle: "movable", value: (_i, d) => d.fastText ?? "" },
	{ name: "commemorations", cycle: "fixed", value: (iso) => commemKey(commemorations.get(iso) ?? []) },
	{ name: "troparia(saints)", cycle: "fixed", value: (_i, d) => hymnsKey(withSaints(d.troparia)) },
	{ name: "kontakia(saints)", cycle: "fixed", value: (_i, d) => hymnsKey(withSaints(d.kontakia)) },
	{ name: "troparia(day)", cycle: "movable", value: (_i, d) => hymnsKey(noSaints(d.troparia)) },
	{ name: "kontakia(day)", cycle: "movable", value: (_i, d) => hymnsKey(noSaints(d.kontakia)) },
];

interface Report {
	readonly field: string;
	readonly cycle: "fixed" | "movable";
	readonly uniqueKeys: number;
	readonly inconsistentKeys: number;
	readonly consistencyRate: number;
	readonly inconsistentExamples: readonly string[];
}

const results: Report[] = [];
const inconsistentDetail = new Map<string, string[]>();

for (const field of fields) {
	const groups = new Map<string, Set<string>>();
	for (const iso of Object.keys(DAYS.days)) {
		const d = DAYS.days[iso]!;
		const key = field.cycle === "fixed" ? fixedKey(iso) : String(movableKey(iso));
		const v = field.value(iso, d);
		let set = groups.get(key);
		if (set === undefined) {
			set = new Set();
			groups.set(key, set);
		}
		set.add(v);
	}
	const inconsistentKeys: string[] = [];
	for (const [k, vs] of groups) {
		if (vs.size > 1) inconsistentKeys.push(k);
	}
	const uniqueKeys = groups.size;
	const consistencyRate = (uniqueKeys - inconsistentKeys.length) / uniqueKeys;
	inconsistentKeys.sort();
	results.push({
		field: field.name,
		cycle: field.cycle,
		uniqueKeys,
		inconsistentKeys: inconsistentKeys.length,
		consistencyRate,
		inconsistentExamples: inconsistentKeys.slice(0, 5),
	});
	inconsistentDetail.set(field.name, inconsistentKeys);
}

console.log("Field decomposition analysis (2025–2027 window):");
console.log();
console.log(
	"field".padEnd(22) +
		"cycle".padEnd(10) +
		"keys".padStart(6) +
		"incons.".padStart(10) +
		"rate".padStart(10),
);
console.log("-".repeat(58));
for (const r of results) {
	console.log(
		r.field.padEnd(22) +
			r.cycle.padEnd(10) +
			String(r.uniqueKeys).padStart(6) +
			String(r.inconsistentKeys).padStart(10) +
			(r.consistencyRate * 100).toFixed(2).padStart(9) +
			"%",
	);
}
console.log();
for (const r of results) {
	if (r.inconsistentExamples.length > 0) {
		console.log(
			`inconsistent ${r.field} (${r.cycle}) examples: ${r.inconsistentExamples.join(", ")}`,
		);
	}
}

// Flag ISO dates that have ANY inconsistent field — these would need to be
// stored as per-ISO exceptions in the final emission.
const exceptionIsos = new Set<string>();
for (const iso of Object.keys(DAYS.days)) {
	const d = DAYS.days[iso]!;
	for (const field of fields) {
		const key = field.cycle === "fixed" ? fixedKey(iso) : String(movableKey(iso));
		const inconsistent = inconsistentDetail.get(field.name)!.includes(key);
		if (inconsistent) {
			exceptionIsos.add(iso);
			break;
		}
	}
}
console.log();
console.log(`total days in window: ${Object.keys(DAYS.days).length}`);
console.log(`days needing per-ISO exception storage: ${exceptionIsos.size}`);
console.log(`cleanly cycle-decomposable: ${Object.keys(DAYS.days).length - exceptionIsos.size}`);
