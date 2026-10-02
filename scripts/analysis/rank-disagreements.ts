// Enumerates matched-commemoration pairs where the HTOC glyph does NOT agree
// with the engine rank (after HTOC-shape normalization). Read-only report to
// scratch/htoc-rank-disagreements.md — helps decide whether each mismatch is
// a real tradition split, an overlay gap, or a comparator false positive.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { getLiturgicalDay } from "../../src/engine/index.ts";
import { compareCommemorations } from "./comparators.ts";
import { iterCorpus, SCRATCH_DIR } from "./corpus.ts";

function toCal(iso: string): CalendarDate {
	const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
	return { year: y!, month: m!, day: d! };
}

function normalize(rank: number): string {
	if (rank >= 6) return "6";
	if (rank >= 4) return "4";
	return String(rank);
}

interface Row {
	iso: string;
	rank: string;
	engineRank: number;
	engineGlyph: string;
	text: string;
	engineName: string;
	engineCId: string;
}

const rows: Row[] = [];

for (const { iso, day: htoc } of iterCorpus()) {
	const cal = toCal(iso);
	const engineDay = getLiturgicalDay(cal);
	const comm = compareCommemorations(htoc.commemorations, engineDay.allSaints);
	for (const m of comm.matched) {
		if (m.engineRank === undefined) continue;
		const g = normalize(m.engineRank);
		if (g === m.rank) continue;
		const cId = engineDay.allSaints[m.engineIndex]?.cId ?? "?";
		rows.push({
			iso,
			rank: m.rank,
			engineRank: m.engineRank,
			engineGlyph: g,
			text: m.text.slice(0, 80),
			engineName: m.engineName.slice(0, 60),
			engineCId: cId,
		});
	}
}

// Bucket rows by (rank, engineGlyph) then by cId.
const buckets = new Map<string, Row[]>();
for (const r of rows) {
	const k = `${r.rank}->${r.engineGlyph}`;
	const list = buckets.get(k) ?? [];
	list.push(r);
	buckets.set(k, list);
}

const out: string[] = [];
out.push("# HTOC ↔ engine rank disagreements");
out.push("");
out.push(
	"Every matched commemoration where the engine's HTOC-normalized glyph disagrees with the HTOC rank glyph. Grouped by bucket, then by engine `cId`.",
);
out.push("");

for (const [k, list] of [...buckets.entries()].sort()) {
	out.push(`## \`${k}\` — ${list.length} pair(s)`);
	out.push("");
	// Group within the bucket by cId to collapse annually-recurring saints.
	const byCid = new Map<string, Row[]>();
	for (const r of list) {
		const l = byCid.get(r.engineCId) ?? [];
		l.push(r);
		byCid.set(r.engineCId, l);
	}
	out.push("| cId | engine name | engine rank | dates | htoc text (sample) |");
	out.push("| --- | --- | ---:| --- | --- |");
	for (const [cId, rs] of [...byCid.entries()].sort()) {
		const dates = rs.map((r) => r.iso).join(", ");
		const first = rs[0]!;
		out.push(
			`| \`${cId}\` | ${first.engineName} | ${first.engineRank} | ${dates} | ${first.text} |`,
		);
	}
	out.push("");
}

const outPath = resolve(SCRATCH_DIR, "rank-disagreements.md");
writeFileSync(outPath, out.join("\n"), "utf8");
console.log(`wrote ${outPath} — ${rows.length} rows across ${buckets.size} buckets`);
