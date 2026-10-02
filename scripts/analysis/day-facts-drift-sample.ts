// Investigate why "fixed" fields drift. Pick a sample inconsistent fixed
// key (01-03 Julian = Jan 16 Gregorian) and show the 3 years' values.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { difference as diffG, type CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { fromGregorian } from "../../src/core/calendar/jdate.ts";
import { getOrthodoxPascha } from "../../src/paschalion.ts";

const DAYS = JSON.parse(readFileSync(resolve("scratch/days.json"), "utf8")) as {
	readonly days: Readonly<Record<string, { readonly headerText: string; readonly tone: number | string; readonly fastText: string }>>;
};
const COMMEMS = new Map<string, readonly { rank: string; text: string; minor: boolean }[]>();
for (const y of [2025, 2026, 2027, 2028, 2029, 2030]) {
	const fx = JSON.parse(readFileSync(resolve(`tests/fixtures/full-${y}.json`), "utf8")) as {
		readonly days: Readonly<Record<string, { readonly commemorations: readonly { rank: string; text: string; minor: boolean }[] }>>;
	};
	for (const [iso, d] of Object.entries(fx.days)) {
		COMMEMS.set(iso, d.commemorations ?? []);
	}
}
function parseIso(iso: string): CalendarDate {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	return { year: y, month: m, day: d };
}
function fixedKey(iso: string): string {
	const j = fromGregorian(parseIso(iso));
	return `${String(j.month).padStart(2, "0")}-${String(j.day).padStart(2, "0")}`;
}

// Build Julian MM-DD → list of ISO dates
const byJul = new Map<string, string[]>();
for (const iso of Object.keys(DAYS.days)) {
	const k = fixedKey(iso);
	let b = byJul.get(k);
	if (!b) { b = []; byJul.set(k, b); }
	b.push(iso);
}

for (const julKey of ["01-03", "01-04", "01-10", "06-01", "06-15"]) {
	const isos = (byJul.get(julKey) ?? []).sort();
	console.log(`\n=== Julian ${julKey} (${isos.length} occurrences in window) ===`);
	for (const iso of isos) {
		const d = DAYS.days[iso]!;
		const cs = COMMEMS.get(iso) ?? [];
		const g = parseIso(iso);
		const paschaOffset = diffG(g, getOrthodoxPascha(g.year));
		console.log(`  ${iso} (Pascha-offset ${paschaOffset}):`);
		console.log(`    header:  ${JSON.stringify((d.headerText || "").slice(0, 120))}`);
		console.log(`    fast:    ${JSON.stringify((d.fastText || "").slice(0, 120))}`);
		console.log(`    tone:    ${d.tone}`);
		console.log(`    commems: ${cs.length} items`);
		for (const c of cs.slice(0, 4)) {
			console.log(`      [${c.rank}${c.minor ? "·min" : ""}] ${JSON.stringify(c.text.slice(0, 80))}`);
		}
		if (cs.length > 4) console.log(`      ...+${cs.length - 4} more`);
	}
}
