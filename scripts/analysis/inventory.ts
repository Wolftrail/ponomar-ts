// Phase 1 of the HTOC reverse-engineering plan: enumerate everything the
// scraped corpus contains. Runs across all three years (2025-2027, 1095
// days), emits three artifacts under scratch/:
//
//   rank-inventory.json   — distinct rank glyphs + stats
//   reading-inventory.json — URL-prefix + note taxonomy
//   header-inventory.json  — headerText grammar decomposition
//   inventory.md           — human-skimmable roll-up linking all of them
//
// Read-only. Independent of the engine.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { iterCorpus, YEARS, SCRATCH_DIR } from "./corpus.ts";
import type { Day } from "./corpus.ts";

interface RankStat {
	rank: string;
	count: number;
	minorTrue: number;
	minorFalse: number;
	examples: string[];
}

interface PrefixStat {
	prefix: string;
	count: number;
	examples: string[];
}

interface NoteStat {
	note: string;
	count: number;
	bucket: NoteBucket;
}

type NoteBucket =
	| "hour"
	| "position"
	| "saint"
	| "festal"
	| "matins-gospel"
	| "other";

interface HeaderStat {
	headerText: string;
	count: number;
	week: string | null;
	feast: string | null;
	tone: number | null;
	firstIso: string;
}

interface CorpusStats {
	totalDays: number;
	commemorationsPerDay: {
		mean: number;
		median: number;
		min: number;
		max: number;
		maxIso: string;
	};
	readingsPerDay: {
		mean: number;
		median: number;
		min: number;
		max: number;
		maxIso: string;
	};
	troparionGroupsPerDay: {
		mean: number;
		median: number;
		max: number;
		maxIso: string;
	};
	toneDistribution: Record<string, number>;
	fastTextDistinct: number;
	daysWithoutTone: number;
	daysWithoutFast: number;
}

function classifyNote(note: string): NoteBucket {
	const n = note.trim();
	if (/^\(\s*\d+(st|nd|rd|th)\s+Matins Gospel\s*\)$/i.test(n)) {
		return "matins-gospel";
	}
	if (/^\(\s*\d+(st|nd|rd|th)?\s*(Hour)\s*\)$/i.test(n)) return "hour";
	if (/6th Hour|3rd Hour|9th Hour|1st Hour/i.test(n)) return "hour";
	if (/Vespers|1st Reading|2nd Reading|3rd Reading/i.test(n)) return "position";
	if (/Gospel|Epistle|Apostol|Prokeimenon/i.test(n)) return "position";
	if (/^\s*St\.?\s|^\s*Ss\.?\s|Apostle|Martyr|Virgin/i.test(n)) return "saint";
	if (/Theotokos|Cross|Feast|Feastday|Forerunner|Baptist/i.test(n)) return "festal";
	return "other";
}

/** HTOC's scripture href looks like:
 *  http://www.holytrinityorthodox.com/calendar/reading/<PREFIX>/<CODE>.htm
 *  http://www.holytrinityorthodox.com/calendar/reading2/<PREFIX>/<CODE>.htm
 *  We return the segment before the code (e.g. "reading/p", "reading2/ae"). */
function classifyHref(href: string): string {
	const m = /\/calendar\/(reading2?\/[^/]+)\//.exec(href);
	return m === null ? "unknown" : m[1]!;
}

const TONE_WORDS = new Set([
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"seven",
	"eight",
]);

const TONE_WORD_MAP: Record<string, number> = {
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
};

/** headerText looks like:
 *   "Fourth Sunday of Pascha: The Paralyzed Man. Tone three."
 *   "Second Week of the Great Lent. Tone four."
 *   "Bright Wednesday. Tone eight."
 *   "The Ascension of Our Lord."   (no tone)
 * We split on "." into sentences; the last sentence starting with "Tone" is
 * the tone; anything else is week+feast candidate. */
function decomposeHeader(headerText: string): {
	week: string | null;
	feast: string | null;
	tone: number | null;
} {
	const parts = headerText
		.split(".")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	let tone: number | null = null;
	const nonTone: string[] = [];
	for (const p of parts) {
		const t = /^Tone\s+([a-z]+)$/i.exec(p);
		if (t !== null && TONE_WORDS.has(t[1]!.toLowerCase())) {
			tone = TONE_WORD_MAP[t[1]!.toLowerCase()] ?? null;
		} else {
			nonTone.push(p);
		}
	}
	// Convention: first non-tone sentence is the week label (or the sole
	// feast title); a ":"-joined feast title after it is the feast.
	let week: string | null = null;
	let feast: string | null = null;
	if (nonTone.length >= 1) {
		const first = nonTone[0]!;
		const colonIdx = first.indexOf(":");
		if (colonIdx >= 0) {
			week = first.slice(0, colonIdx).trim();
			feast = first.slice(colonIdx + 1).trim();
		} else {
			week = first;
		}
		if (nonTone.length >= 2 && feast === null) {
			feast = nonTone.slice(1).join(". ");
		}
	}
	return { week, feast, tone };
}

function median(xs: readonly number[]): number {
	if (xs.length === 0) return 0;
	const sorted = [...xs].sort((a, b) => a - b);
	const mid = sorted.length >>> 1;
	if (sorted.length % 2 === 1) return sorted[mid]!;
	return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function mean(xs: readonly number[]): number {
	if (xs.length === 0) return 0;
	return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function round2(x: number): number {
	return Math.round(x * 100) / 100;
}

interface Accumulator {
	ranks: Map<string, RankStat>;
	prefixes: Map<string, PrefixStat>;
	notes: Map<string, NoteStat>;
	headers: Map<string, HeaderStat>;
	tones: Record<string, number>;
	fastTexts: Set<string>;
	comCounts: number[];
	readCounts: number[];
	tropCounts: number[];
	tropGroups: number[];
	total: number;
	comMaxIso: { iso: string; count: number };
	readMaxIso: { iso: string; count: number };
	tropMaxIso: { iso: string; count: number };
	noTone: number;
	noFast: number;
}

function newAccumulator(): Accumulator {
	return {
		ranks: new Map(),
		prefixes: new Map(),
		notes: new Map(),
		headers: new Map(),
		tones: {},
		fastTexts: new Set(),
		comCounts: [],
		readCounts: [],
		tropCounts: [],
		tropGroups: [],
		total: 0,
		comMaxIso: { iso: "", count: -1 },
		readMaxIso: { iso: "", count: -1 },
		tropMaxIso: { iso: "", count: -1 },
		noTone: 0,
		noFast: 0,
	};
}

function bumpRank(acc: Accumulator, r: string, text: string, minor: boolean): void {
	let s = acc.ranks.get(r);
	if (s === undefined) {
		s = { rank: r, count: 0, minorTrue: 0, minorFalse: 0, examples: [] };
		acc.ranks.set(r, s);
	}
	s.count++;
	if (minor) s.minorTrue++;
	else s.minorFalse++;
	if (s.examples.length < 3) {
		const trimmed = text.length > 120 ? `${text.slice(0, 117)}...` : text;
		if (!s.examples.includes(trimmed)) s.examples.push(trimmed);
	}
}

function bumpPrefix(acc: Accumulator, p: string, cit: string): void {
	let s = acc.prefixes.get(p);
	if (s === undefined) {
		s = { prefix: p, count: 0, examples: [] };
		acc.prefixes.set(p, s);
	}
	s.count++;
	if (s.examples.length < 5 && !s.examples.includes(cit)) s.examples.push(cit);
}

function bumpNote(acc: Accumulator, note: string): void {
	const key = note.trim();
	let s = acc.notes.get(key);
	if (s === undefined) {
		s = { note: key, count: 0, bucket: classifyNote(key) };
		acc.notes.set(key, s);
	}
	s.count++;
}

function bumpHeader(
	acc: Accumulator,
	iso: string,
	day: Day,
): void {
	const key = day.headerText;
	let s = acc.headers.get(key);
	if (s === undefined) {
		const decomposed = decomposeHeader(key);
		s = {
			headerText: key,
			count: 0,
			week: decomposed.week,
			feast: decomposed.feast,
			tone: decomposed.tone,
			firstIso: iso,
		};
		acc.headers.set(key, s);
	}
	s.count++;
}

function ingest(acc: Accumulator, iso: string, day: Day): void {
	acc.total++;
	for (const c of day.commemorations) bumpRank(acc, c.rank, c.text, c.minor);
	for (const r of day.scripture) {
		bumpPrefix(acc, classifyHref(r.href), r.citation);
		if (r.note !== undefined && r.note.length > 0) bumpNote(acc, r.note);
	}
	bumpHeader(acc, iso, day);

	const cc = day.commemorations.length;
	acc.comCounts.push(cc);
	if (cc > acc.comMaxIso.count) acc.comMaxIso = { iso, count: cc };

	const rc = day.scripture.length;
	acc.readCounts.push(rc);
	if (rc > acc.readMaxIso.count) acc.readMaxIso = { iso, count: rc };

	const tc = day.troparia.length;
	acc.tropCounts.push(tc);
	if (tc > acc.tropMaxIso.count) acc.tropMaxIso = { iso, count: tc };

	const groupCount =
		day.troparia.length === 0
			? 0
			: new Set(day.troparia.map((h) => h.group)).size;
	acc.tropGroups.push(groupCount);

	const toneKey = day.tone === null ? "none" : String(day.tone);
	acc.tones[toneKey] = (acc.tones[toneKey] ?? 0) + 1;
	if (day.tone === null) acc.noTone++;

	if (day.fastText === null || day.fastText.length === 0) acc.noFast++;
	else acc.fastTexts.add(day.fastText);
}

function toStats(acc: Accumulator): CorpusStats {
	return {
		totalDays: acc.total,
		commemorationsPerDay: {
			mean: round2(mean(acc.comCounts)),
			median: median(acc.comCounts),
			min: Math.min(...acc.comCounts),
			max: acc.comMaxIso.count,
			maxIso: acc.comMaxIso.iso,
		},
		readingsPerDay: {
			mean: round2(mean(acc.readCounts)),
			median: median(acc.readCounts),
			min: Math.min(...acc.readCounts),
			max: acc.readMaxIso.count,
			maxIso: acc.readMaxIso.iso,
		},
		troparionGroupsPerDay: {
			mean: round2(mean(acc.tropGroups)),
			median: median(acc.tropGroups),
			max: Math.max(...acc.tropGroups),
			maxIso: acc.tropMaxIso.iso,
		},
		toneDistribution: acc.tones,
		fastTextDistinct: acc.fastTexts.size,
		daysWithoutTone: acc.noTone,
		daysWithoutFast: acc.noFast,
	};
}

function bySortedCount<T extends { count: number }>(xs: Iterable<T>): T[] {
	return [...xs].sort((a, b) => b.count - a.count);
}

function writeJson(path: string, data: unknown): void {
	writeFileSync(path, `${JSON.stringify(data, null, "\t")}\n`, "utf8");
}

function fmtPct(n: number, total: number): string {
	if (total === 0) return "0.0%";
	return `${((n / total) * 100).toFixed(1)}%`;
}

function renderMarkdown(
	stats: CorpusStats,
	ranks: RankStat[],
	prefixes: PrefixStat[],
	notes: NoteStat[],
	headers: HeaderStat[],
	fastTextsSample: string[],
): string {
	const lines: string[] = [];
	lines.push("# HTOC corpus inventory");
	lines.push("");
	lines.push(
		`Generated by [scripts/analysis/inventory.ts](../scripts/analysis/inventory.ts).`,
	);
	lines.push(
		`Source: \`tests/fixtures/full-{${YEARS.join(",")}}.json\`.`,
	);
	lines.push("");
	lines.push("## Corpus stats");
	lines.push("");
	lines.push(`- Total days: **${stats.totalDays}**`);
	lines.push(
		`- Commemorations/day — mean ${stats.commemorationsPerDay.mean}, median ${stats.commemorationsPerDay.median}, range ${stats.commemorationsPerDay.min}..${stats.commemorationsPerDay.max} (max on ${stats.commemorationsPerDay.maxIso})`,
	);
	lines.push(
		`- Readings/day — mean ${stats.readingsPerDay.mean}, median ${stats.readingsPerDay.median}, range ${stats.readingsPerDay.min}..${stats.readingsPerDay.max} (max on ${stats.readingsPerDay.maxIso})`,
	);
	lines.push(
		`- Troparion groups/day — mean ${stats.troparionGroupsPerDay.mean}, median ${stats.troparionGroupsPerDay.median}, max ${stats.troparionGroupsPerDay.max} (${stats.troparionGroupsPerDay.maxIso})`,
	);
	lines.push(
		`- Tone distribution: ${Object.entries(stats.toneDistribution)
			.sort(([a], [b]) => (a === "none" ? 1 : b === "none" ? -1 : Number(a) - Number(b)))
			.map(([k, v]) => `${k}=${v}`)
			.join(", ")}`,
	);
	lines.push(`- Days without a tone: **${stats.daysWithoutTone}**`);
	lines.push(
		`- Distinct \`fastText\` strings: **${stats.fastTextDistinct}** (${stats.daysWithoutFast} days empty)`,
	);
	lines.push("");
	lines.push("## Rank glyphs");
	lines.push("");
	lines.push("| rank | count | minor% | major% | example |");
	lines.push("| --- | ---:| ---:| ---:| --- |");
	for (const r of ranks) {
		lines.push(
			`| \`${r.rank}\` | ${r.count} | ${fmtPct(r.minorTrue, r.count)} | ${fmtPct(r.minorFalse, r.count)} | ${(r.examples[0] ?? "").replace(/\|/g, "\\|")} |`,
		);
	}
	lines.push("");
	lines.push("## Scripture URL prefixes");
	lines.push("");
	lines.push("| prefix | count | example citations |");
	lines.push("| --- | ---:| --- |");
	for (const p of prefixes) {
		lines.push(
			`| \`${p.prefix}\` | ${p.count} | ${p.examples.slice(0, 3).join("; ")} |`,
		);
	}
	lines.push("");
	lines.push("## Reading notes (top 40 by count)");
	lines.push("");
	lines.push("| bucket | note | count |");
	lines.push("| --- | --- | ---:|");
	for (const n of notes.slice(0, 40)) {
		lines.push(
			`| ${n.bucket} | ${n.note.replace(/\|/g, "\\|")} | ${n.count} |`,
		);
	}
	lines.push("");
	lines.push(
		`Total distinct notes: **${notes.length}**. Full list in \`reading-inventory.json\`.`,
	);
	lines.push("");
	lines.push("## Header lines (top 40 by count)");
	lines.push("");
	lines.push("| headerText | count | week | feast | tone | first ISO |");
	lines.push("| --- | ---:| --- | --- | ---:| --- |");
	for (const h of headers.slice(0, 40)) {
		lines.push(
			`| ${h.headerText.replace(/\|/g, "\\|")} | ${h.count} | ${h.week ?? "-"} | ${(h.feast ?? "-").replace(/\|/g, "\\|")} | ${h.tone ?? "-"} | ${h.firstIso} |`,
		);
	}
	lines.push("");
	lines.push(
		`Total distinct headerText: **${headers.length}**. Full list in \`header-inventory.json\`.`,
	);
	lines.push("");
	lines.push("## Fasting text samples (first 20 distinct)");
	lines.push("");
	for (const f of fastTextsSample.slice(0, 20)) {
		lines.push(`- \`${f}\``);
	}
	return `${lines.join("\n")}\n`;
}

function main(): void {
	if (!existsSync(SCRATCH_DIR)) mkdirSync(SCRATCH_DIR, { recursive: true });
	const acc = newAccumulator();
	for (const { iso, day } of iterCorpus()) ingest(acc, iso, day);

	const stats = toStats(acc);
	const ranks = bySortedCount(acc.ranks.values());
	const prefixes = bySortedCount(acc.prefixes.values());
	const notes = bySortedCount(acc.notes.values());
	const headers = bySortedCount(acc.headers.values());
	const fastTextsSample = [...acc.fastTexts].sort();

	writeJson(resolve(SCRATCH_DIR, "rank-inventory.json"), {
		stats: {
			distinctRanks: ranks.length,
			total: ranks.reduce((a, r) => a + r.count, 0),
		},
		ranks,
	});
	writeJson(resolve(SCRATCH_DIR, "reading-inventory.json"), {
		stats: {
			distinctPrefixes: prefixes.length,
			distinctNotes: notes.length,
		},
		prefixes,
		notes,
	});
	writeJson(resolve(SCRATCH_DIR, "header-inventory.json"), {
		stats: {
			distinctHeaders: headers.length,
			daysWithoutTone: stats.daysWithoutTone,
		},
		headers,
	});
	writeJson(resolve(SCRATCH_DIR, "corpus-stats.json"), stats);
	writeJson(resolve(SCRATCH_DIR, "fast-texts.json"), fastTextsSample);

	const md = renderMarkdown(stats, ranks, prefixes, notes, headers, fastTextsSample);
	writeFileSync(resolve(SCRATCH_DIR, "inventory.md"), md, "utf8");

	process.stdout.write(`wrote ${SCRATCH_DIR}/inventory.md\n`);
	process.stdout.write(`  ranks:    ${ranks.length}\n`);
	process.stdout.write(`  prefixes: ${prefixes.length}\n`);
	process.stdout.write(`  notes:    ${notes.length}\n`);
	process.stdout.write(`  headers:  ${headers.length}\n`);
	process.stdout.write(`  fasts:    ${fastTextsSample.length}\n`);
	process.stdout.write(`  days:     ${stats.totalDays}\n`);
}

main();
