// Sunday-only Liturgy coverage audit: walk every Sunday in the corpus,
// diff engine vs HTOC Liturgy-tagged readings, and characterize each gap.
// This is the concrete input for deciding what "Sunday-liturgy pericope
// enumeration" work is still needed.

import type { CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { getLiturgicalDay } from "../../src/engine/index.ts";
import { getOrderedLiturgyReadings } from "../../src/engine/orderedLiturgy.ts";
import { compareReadings } from "./comparators.ts";
import { iterCorpus } from "./corpus.ts";
import type { HtocScriptureReading } from "./corpus.ts";

function toCal(iso: string): CalendarDate {
	const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
	return { year: y!, month: m!, day: d! };
}

function bucketHtoc(note: string): "liturgy" | "matins" | "vespers" | "hour" {
	if (note === "") return "liturgy";
	if (/matins/i.test(note)) return "matins";
	if (/vespers?/i.test(note)) return "vespers";
	if (/\b(1st|3rd|6th|9th)\s+hour\b/i.test(note)) return "hour";
	return "liturgy";
}

interface Row {
	iso: string;
	nday: number;
	htocApostles: string[];
	htocGospels: string[];
	engineApostles: string[];
	engineGospels: string[];
	htocOnly: string[];
	engineOnly: string[];
}

const rows: Row[] = [];

for (const { iso, day: htoc } of iterCorpus()) {
	const cal = toCal(iso);
	const engineDay = getLiturgicalDay(cal);
	if (engineDay.context.dow !== 0) continue;
	const lit = getOrderedLiturgyReadings(cal);
	const engineBag = [...lit.apostol, ...lit.gospel, ...lit.suppressed];
	const htocLit: HtocScriptureReading[] = [];
	for (const r of htoc.scripture) {
		if (bucketHtoc(r.note ?? "") === "liturgy") htocLit.push(r);
	}
	const cmp = compareReadings(htocLit, engineBag);
	if (cmp.htocOnly.length === 0 && cmp.engineOnly.length === 0) continue;
	rows.push({
		iso,
		nday: engineDay.context.nday,
		htocApostles: htocLit
			.filter((r) => /^[123]?\s*(Rom|Cor|Gal|Eph|Phil|Col|Thess|Tim|Tit|Philem|Heb|Jas|Pet|Jn|John|Jude|Acts)/i.test(r.citation.trim()))
			.map((r) => r.citation),
		htocGospels: htocLit
			.filter((r) => /^(Mat|Mar|Luk|Joh|Mt|Mk|Lk|Jn)/i.test(r.citation.trim()))
			.map((r) => r.citation),
		engineApostles: lit.apostol.map((r) => `${r.reading}${r.pericope !== undefined ? ` (p${r.pericope})` : ""} [${r.rank}]`),
		engineGospels: lit.gospel.map((r) => `${r.reading}${r.pericope !== undefined ? ` (p${r.pericope})` : ""} [${r.rank}]`),
		htocOnly: cmp.htocOnly.map((r) => `${r.citation}${r.note ? ` "${r.note}"` : ""}`),
		engineOnly: cmp.engineOnly.map((r) => `${r.reading}`),
	});
}

console.log(`Sundays with any Liturgy-bucket disagreement: ${rows.length} / ~156 Sundays across 3 years\n`);

if (rows.length === 0) {
	console.log("All Sundays are clean.");
	process.exit(0);
}

// Group by (sorted htocOnly, sorted engineOnly).
const groups = new Map<string, Row[]>();
for (const r of rows) {
	const key = JSON.stringify({ h: r.htocOnly.slice().sort(), e: r.engineOnly.slice().sort() });
	if (!groups.has(key)) groups.set(key, []);
	groups.get(key)!.push(r);
}
const sortedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [_, list] of sortedGroups) {
	const rep = list[0]!;
	const dates = list.map((r) => `${r.iso} nday=${r.nday}`).join(", ");
	console.log(`── ${list.length}× ──`);
	console.log(`  dates:      ${dates}`);
	console.log(`  htocOnly:   ${rep.htocOnly.join(" | ") || "(none)"}`);
	console.log(`  engineOnly: ${rep.engineOnly.join(" | ") || "(none)"}`);
	console.log("");
}
