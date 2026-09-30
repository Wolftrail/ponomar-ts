// Phase 2 of the HTOC reverse-engineering plan: render side-by-side deltas
// for a curated set of days that span the liturgical year. Human-readable
// markdown only — the machine metrics come in Phase 3.
//
// Reads the corpus via `./corpus.ts` and calls the engine directly. Writes
// `scratch/htoc-deltas.md`. Read-only w.r.t. the engine and the corpus.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { getLiturgicalDay } from "../../src/engine/index.ts";
import { getOrderedLiturgyReadings } from "../../src/engine/orderedLiturgy.ts";
import { getOrderedMatinsReadings } from "../../src/engine/orderedMatins.ts";
import { getDailyReadings } from "../../src/engine/readings.ts";
import type { ReadingRef } from "../../src/engine/readings.ts";
import type { ResolvedSaint } from "../../src/engine/resolve.ts";
import { loadYear, SCRATCH_DIR } from "./corpus.ts";
import type { HtocCommemoration, HtocDay, HtocScriptureReading } from "./corpus.ts";

interface Sample {
	readonly iso: string;
	readonly label: string;
}

// 12 days chosen to span jurisdictions, cycles, and rank profiles.
// Note Gregorian Pascha 2025 = Apr 20; Nativity Jan 7 2026 = Julian Dec 25.
const SAMPLES: readonly Sample[] = [
	{ iso: "2025-03-14", label: "Great Lent Fri (Lenten weekday)" },
	{ iso: "2025-04-18", label: "Great Friday (max readings day)" },
	{ iso: "2025-04-21", label: "Bright Monday" },
	{ iso: "2025-04-25", label: "Bright Friday" },
	{ iso: "2025-06-08", label: "Pentecost 2025 (Sunday)" },
	{ iso: "2025-06-27", label: "Apostles' Fast Friday" },
	{ iso: "2025-08-07", label: "Ordinary summer Thursday" },
	{ iso: "2025-08-19", label: "Transfiguration (fixed Great Feast)" },
	{ iso: "2025-08-28", label: "Dormition (fixed Great Feast)" },
	{ iso: "2025-11-30", label: "Nativity Fast Sunday" },
	{ iso: "2026-01-06", label: "Nativity Eve" },
	{ iso: "2026-01-07", label: "Nativity" },
];

function toCal(iso: string): CalendarDate {
	const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
	if (y === undefined || m === undefined || d === undefined) {
		throw new Error(`bad iso: ${iso}`);
	}
	return { year: y, month: m, day: d };
}

function saintDisplay(s: ResolvedSaint): string {
	const name =
		s.name?.short ??
		s.name?.nominative ??
		s.name?.long ??
		s.name?.index ??
		"(anon)";
	const rank = s.church?.rank !== undefined ? String(s.church.rank) : "-";
	const src = s.src ?? "-";
	return `${s.cId.padEnd(6)} rank=${rank}  src=${src.padStart(6)}  ${name}`;
}

function htocComDisplay(c: HtocCommemoration): string {
	const minor = c.minor ? "min" : "maj";
	const text = c.text.length > 90 ? `${c.text.slice(0, 87)}...` : c.text;
	return `${c.rank.padEnd(3)} ${minor}  ${text}`;
}

function readingDisplay(r: ReadingRef): string {
	const bits = [
		`${r.type.padEnd(7)}`,
		`${r.source.padEnd(7)}`,
		`${r.service.padEnd(7)}`,
		`cId=${r.cId.padEnd(6)}`,
		r.reading,
	];
	if (r.note !== undefined) bits.push(`— ${r.note}`);
	return bits.join(" ");
}

function htocScriptureDisplay(s: HtocScriptureReading): string {
	const prefixMatch = /\/calendar\/(reading2?\/[^/]+)\//.exec(s.href);
	const prefix = prefixMatch === null ? "?" : prefixMatch[1]!;
	const note = s.note ? ` — ${s.note}` : "";
	return `${prefix.padEnd(12)}  ${s.citation}${note}`;
}

function renderDay(sample: Sample, htoc: HtocDay): string {
	const cal = toCal(sample.iso);
	const day = getLiturgicalDay(cal);
	const lit = getOrderedLiturgyReadings(cal);
	const matins = getOrderedMatinsReadings(cal);
	const vespers = getDailyReadings(cal, { service: "vespers" });
	const primes = getDailyReadings(cal, { service: "primes" });

	const lines: string[] = [];
	lines.push(`## ${sample.iso} — ${sample.label}`);
	lines.push("");
	lines.push(
		`- HTOC header: **${htoc.headerText}**  · tone=${htoc.tone ?? "-"}  · fast=${htoc.fastText === null ? "-" : `\`${htoc.fastText}\``}`,
	);
	lines.push(
		`- Julian ${htoc.julian.year}-${String(htoc.julian.month).padStart(2, "0")}-${String(htoc.julian.day).padStart(2, "0")}  · weekday=${htoc.civil.weekday}  · dow=${day.context.dow}  · nday=${day.context.nday}  · dRank=${day.dRank}  · engineTone=${day.tone ?? "-"}`,
	);
	lines.push("");

	// Commemorations
	lines.push("### Commemorations");
	lines.push("");
	lines.push(
		`HTOC (${htoc.commemorations.length}) — glyph, minor/major, text:`,
	);
	lines.push("```");
	for (const c of htoc.commemorations) lines.push(htocComDisplay(c));
	lines.push("```");
	lines.push("");
	lines.push(`Engine (${day.allSaints.length}):`);
	lines.push("```");
	for (const s of day.allSaints) lines.push(saintDisplay(s));
	lines.push("```");
	lines.push("");

	// Scripture
	lines.push("### Scripture");
	lines.push("");
	lines.push(`HTOC (${htoc.scripture.length}):`);
	lines.push("```");
	for (const r of htoc.scripture) lines.push(htocScriptureDisplay(r));
	lines.push("```");
	lines.push("");
	lines.push("Engine — Liturgy ordered:");
	lines.push("```");
	lines.push(`apostol (${lit.apostol.length}):`);
	for (const r of lit.apostol) lines.push(`  ${readingDisplay(r)}`);
	lines.push(`gospel (${lit.gospel.length}):`);
	for (const r of lit.gospel) lines.push(`  ${readingDisplay(r)}`);
	if (lit.suppressed.length > 0) {
		lines.push(`suppressed (${lit.suppressed.length}):`);
		for (const r of lit.suppressed) lines.push(`  ${readingDisplay(r)}`);
	}
	lines.push("```");
	lines.push("");
	lines.push("Engine — Matins refs (ordered):");
	lines.push("```");
	for (const r of matins.refs) lines.push(`  ${readingDisplay(r)}`);
	if (matins.suppressed.length > 0) {
		lines.push(`suppressed (${matins.suppressed.length}):`);
		for (const r of matins.suppressed) lines.push(`  ${readingDisplay(r)}`);
	}
	lines.push("```");
	lines.push("");
	if (vespers.refs.length > 0) {
		lines.push("Engine — Vespers refs:");
		lines.push("```");
		for (const r of vespers.refs) lines.push(`  ${readingDisplay(r)}`);
		lines.push("```");
		lines.push("");
	}
	if (primes.refs.length > 0) {
		lines.push("Engine — Primes / Hour refs:");
		lines.push("```");
		for (const r of primes.refs) lines.push(`  ${readingDisplay(r)}`);
		lines.push("```");
		lines.push("");
	}
	return lines.join("\n");
}

function main(): void {
	if (!existsSync(SCRATCH_DIR)) mkdirSync(SCRATCH_DIR, { recursive: true });

	const corpora = new Map<number, ReturnType<typeof loadYear>>();
	function corpusFor(year: number): ReturnType<typeof loadYear> {
		let c = corpora.get(year);
		if (c === undefined) {
			c = loadYear(year);
			corpora.set(year, c);
		}
		return c;
	}

	const out: string[] = [];
	out.push("# HTOC vs. engine — side-by-side deltas");
	out.push("");
	out.push(
		"Generated by [scripts/analysis/deltas.ts](../scripts/analysis/deltas.ts). Read left column (HTOC) vs. right (engine) per day.",
	);
	out.push("");
	out.push("HTOC glyph legend (from Phase 1 inventory):");
	out.push("");
	out.push("| glyph | major/minor mix | likely meaning |");
	out.push("| --- | --- | --- |");
	out.push("| `o` | 78% minor | optional / regional / Greek-Celtic |");
	out.push("| `0` | 99% major | ordinary saint of the day |");
	out.push("| `1` | 100% major | sixth-class / small commemoration |");
	out.push("| `2` | 100% major | fifth-class |");
	out.push("| `3` | 100% major | fourth-class (Theotokos synaxis, etc.) |");
	out.push("| `4` | 99% major | third-class (polyeleos)? |");
	out.push("| `5` | 92% major | second-class (vigil)? |");
	out.push("| `6` | 100% major | first-class (Great Feasts) — Nativity, Dormition, etc. |");
	out.push("");

	for (const sample of SAMPLES) {
		const year = Number.parseInt(sample.iso.slice(0, 4), 10);
		const c = corpusFor(year);
		const day = c.days[sample.iso];
		if (day === undefined) {
			out.push(`## ${sample.iso} — ${sample.label}\n\nNo corpus entry.\n`);
			continue;
		}
		out.push(renderDay(sample, day));
	}

	const path = resolve(SCRATCH_DIR, "htoc-deltas.md");
	writeFileSync(path, `${out.join("\n")}\n`, "utf8");
	process.stdout.write(`wrote ${path} (${SAMPLES.length} days)\n`);
}

main();
