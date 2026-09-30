// Fetch the full daily HTOC calendar fragment
// (dt=1&header=1&lives=1&trp=1&scripture=1) for a Gregorian date range and
// write a structured JSON cache to `tests/fixtures/htoc-full-<YEAR>.json`.
//
// This is a research aid used to compare our derived data against the
// holytrinityorthodox.com (Russian Orthodox / OCA-flavor) calendar. Output
// is gitignored (not redistributed).
//
// Usage:
//   node --experimental-strip-types scripts/scrape-htoc-full.ts \
//       --year 2025 [--year 2026 ...] [--delay 400] [--refresh]
//   node --experimental-strip-types scripts/scrape-htoc-full.ts \
//       --from 2025-01-01 --to 2027-12-31 [--delay 400]
//
// Idempotent: existing entries in the per-year output are preserved; only
// missing dates are re-fetched.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const HTOC_BASE = "https://www.holytrinityorthodox.com/calendar/calendar.php";
const HTOC_PARAMS = "dt=1&header=1&lives=1&trp=1&scripture=1";
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "..", "tests", "fixtures");

interface LivesLink {
	readonly name: string;
	readonly href: string;
}

interface Commemoration {
	/** Rank icon filename from `.../jcal_img/<rank>.gif` — one of
	 *  `0`, `1`, `2`, `3`, `4`, `5`, `6`, `o`, `r`, `no`, etc. */
	readonly rank: string;
	/** Plain-text commemoration line with tags and links stripped. */
	readonly text: string;
	/** True when the entry is wrapped in `<span class="minortext">`
	 *  (typically Greek / Celtic / local commemorations). */
	readonly minor: boolean;
	/** Any `<a href="…/los/…">…</a>` targets found in the entry. */
	readonly lives: readonly LivesLink[];
}

interface ScriptureReading {
	readonly citation: string;
	readonly href: string;
	readonly note?: string;
}

interface Hymn {
	readonly title: string;
	readonly text: string;
	/** 0-based index; increments at each `.troparionseparator` block. */
	readonly group: number;
}

interface DayRecord {
	readonly civil: {
		readonly weekday: string;
		readonly month: number;
		readonly day: number;
		readonly year: number;
	};
	readonly julian: {
		readonly month: number;
		readonly day: number;
		readonly year: number;
	};
	/** Feast/tone header line, plain text. */
	readonly headerText: string;
	readonly tone: number | null;
	/** Text from `<span class="headerfast">`, plain-text; `null` if empty. */
	readonly fastText: string | null;
	readonly commemorations: readonly Commemoration[];
	readonly scripture: readonly ScriptureReading[];
	readonly troparia: readonly Hymn[];
}

interface Corpus {
	readonly source: string;
	readonly params: string;
	readonly year: number;
	readonly fetchedAt: string;
	readonly days: Record<string, DayRecord>;
}

// ---------- args ----------

interface Args {
	readonly ranges: readonly { from: string; to: string }[];
	readonly delay: number;
	readonly refresh: boolean;
}

function parseArgs(argv: readonly string[]): Args {
	const years: number[] = [];
	let from: string | null = null;
	let to: string | null = null;
	let delay = 400;
	let refresh = false;
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		const v = argv[i + 1];
		if (a === "--year" && v !== undefined) {
			years.push(Number.parseInt(v, 10));
			i++;
		} else if (a === "--from" && v !== undefined) {
			from = v;
			i++;
		} else if (a === "--to" && v !== undefined) {
			to = v;
			i++;
		} else if (a === "--delay" && v !== undefined) {
			delay = Number.parseInt(v, 10);
			i++;
		} else if (a === "--refresh") {
			refresh = true;
		} else {
			throw new Error(`unknown argument: ${a}`);
		}
	}
	const ranges: { from: string; to: string }[] = [];
	for (const y of years) {
		if (!Number.isFinite(y) || y < 1900 || y > 2200) {
			throw new Error(`bad year: ${y}`);
		}
		ranges.push({ from: `${y}-01-01`, to: `${y}-12-31` });
	}
	if (from !== null && to !== null) {
		ranges.push({ from, to });
	} else if (from !== null || to !== null) {
		throw new Error("--from and --to must be provided together");
	}
	if (ranges.length === 0) {
		throw new Error("required: --year YYYY (repeatable) or --from/--to");
	}
	return { ranges, delay, refresh };
}

function eachDay(from: string, to: string): string[] {
	const start = new Date(`${from}T00:00:00Z`);
	const end = new Date(`${to}T00:00:00Z`);
	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
		throw new Error(`bad date: from=${from} to=${to}`);
	}
	const out: string[] = [];
	for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
		out.push(new Date(t).toISOString().slice(0, 10));
	}
	return out;
}

// ---------- fetch ----------

function urlFor(iso: string): string {
	const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
	if (y === undefined || m === undefined || d === undefined) {
		throw new Error(`bad iso: ${iso}`);
	}
	return `${HTOC_BASE}?month=${m}&today=${d}&year=${y}&${HTOC_PARAMS}`;
}

async function fetchDay(iso: string): Promise<string> {
	const res = await fetch(urlFor(iso), {
		headers: {
			"User-Agent":
				"ponomar-ts research scraper (https://github.com/wolfgangnothdurft/ponomar-ts)",
		},
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${iso}`);
	// The site is served as windows-1252 (English text with cp1252 em dashes
	// at 0x97). The default UTF-8 decode mangles those to U+FFFD.
	const buf = await res.arrayBuffer();
	return new TextDecoder("windows-1252").decode(buf);
}

// ---------- parsers ----------

const MONTHS: Record<string, number> = {
	January: 1,
	February: 2,
	March: 3,
	April: 4,
	May: 5,
	June: 6,
	July: 7,
	August: 8,
	September: 9,
	October: 10,
	November: 11,
	December: 12,
};

const RE_DATA_HEADER =
	/<span class="dataheader">([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})\s*\/\s*([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})<\/span>/;

function parseDataHeader(html: string): {
	civil: DayRecord["civil"];
	julian: DayRecord["julian"];
} {
	const m = RE_DATA_HEADER.exec(html);
	if (m === null) throw new Error("data header not found");
	const civMon = MONTHS[m[2]!];
	const julMon = MONTHS[m[5]!];
	if (civMon === undefined || julMon === undefined) {
		throw new Error(`bad month in header: ${m[2]} / ${m[5]}`);
	}
	return {
		civil: {
			weekday: m[1]!,
			month: civMon,
			day: Number.parseInt(m[3]!, 10),
			year: Number.parseInt(m[4]!, 10),
		},
		julian: {
			month: julMon,
			day: Number.parseInt(m[6]!, 10),
			year: Number.parseInt(m[7]!, 10),
		},
	};
}

const TONE_WORDS: Record<string, number> = {
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
};

const RE_HEADER_BLOCK =
	/<span class="headerheader">([\s\S]*?)<\/span>\s*<\/p>/;
const RE_HEADER_FAST = /<span class="headerfast">([\s\S]*?)<\/span>/;

function stripTags(html: string): string {
	return html
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, " ")
		.trim();
}

function parseHeader(html: string): {
	headerText: string;
	tone: number | null;
	fastText: string | null;
} {
	const m = RE_HEADER_BLOCK.exec(html);
	if (m === null) return { headerText: "", tone: null, fastText: null };
	const inner = m[1]!;
	const fastMatch = RE_HEADER_FAST.exec(inner);
	const fastRaw = fastMatch === null ? "" : stripTags(fastMatch[1]!);
	// Remove the .headerfast subspan before extracting the feast title.
	const withoutFast = inner.replace(RE_HEADER_FAST, "");
	const headerText = stripTags(withoutFast);
	const toneMatch = /\bTone\s+([a-z]+)\b/i.exec(headerText);
	const tone =
		toneMatch === null ? null : (TONE_WORDS[toneMatch[1]!.toLowerCase()] ?? null);
	return {
		headerText,
		tone,
		fastText: fastRaw.length > 0 ? fastRaw : null,
	};
}

// ---------- section slicing ----------

function sliceBetween(html: string, start: string, end: string): string {
	const s = html.indexOf(start);
	if (s < 0) return "";
	const from = s + start.length;
	const e = html.indexOf(end, from);
	return e < 0 ? html.slice(from) : html.slice(from, e);
}

/** Extract the commemorations `<span class="normaltext">…</span>` block that
 *  sits between the feast header and the scripture header. */
function extractCommemorationsBlock(html: string): string {
	// Between the closing </p> of pheaderheader and the opening of
	// pscriptureheader.
	const startAnchor = '<p class="pheaderheader">';
	const endAnchor = '<p class="pscriptureheader">';
	const region = sliceBetween(html, startAnchor, endAnchor);
	if (region.length === 0) return "";
	// Take the first normaltext span in that region.
	const s = region.indexOf('<span class="normaltext">');
	if (s < 0) return "";
	return region.slice(s + '<span class="normaltext">'.length);
}

function extractScriptureBlock(html: string): string {
	const startAnchor = '<p class="pscriptureheader">';
	const endAnchor = '<p class="ptroparionheader">';
	const region = sliceBetween(html, startAnchor, endAnchor);
	if (region.length === 0) {
		// Troparia disabled; take everything after scripture header.
		const s = html.indexOf(startAnchor);
		if (s < 0) return "";
		return html.slice(s);
	}
	const s = region.indexOf('<span class="normaltext">');
	if (s < 0) return "";
	return region.slice(s + '<span class="normaltext">'.length);
}

function extractTroparionBlock(html: string): string {
	const startAnchor = '<p class="ptroparionheader">';
	const s = html.indexOf(startAnchor);
	if (s < 0) return "";
	const region = html.slice(s + startAnchor.length);
	const spanStart = region.indexOf('<span class="normaltext">');
	if (spanStart < 0) return "";
	return region.slice(spanStart + '<span class="normaltext">'.length);
}

// ---------- commemorations ----------

const RE_LOS_LINK =
	/<a[^>]+href="([^"]+\/los\/[^"]+)"[^>]*>([^<]+)<\/a>/g;

/** Split the commemorations block into per-entry HTML chunks. Each chunk
 *  starts with `<img ... jcal_img/<rank>.gif>` and runs to the next `<br>`
 *  or `<img>` at the same nesting depth (we treat the raw text linearly
 *  since HTOC does not nest entries). */
function parseCommemorations(block: string): Commemoration[] {
	if (block.length === 0) return [];
	const out: Commemoration[] = [];
	const re =
		/<img[^>]+src="[^"]*\/jcal_img\/([^"]+)\.gif"[^>]*>([\s\S]*?)(?=<img[^>]+src="[^"]*\/jcal_img\/|<\/span>\s*<p |<\/span>\s*$|$)/g;
	for (const m of block.matchAll(re)) {
		const rank = m[1]!.trim();
		const raw = m[2]!;
		// Trim trailing <br> tags.
		const trimmed = raw.replace(/(?:<br\s*\/?>)+\s*$/i, "");
		const minor = /<span class="minortext\s*"/i.test(trimmed);
		const lives: LivesLink[] = [];
		for (const lm of trimmed.matchAll(RE_LOS_LINK)) {
			lives.push({ name: stripTags(lm[2]!), href: lm[1]! });
		}
		const text = stripTags(trimmed);
		if (text.length === 0) continue;
		out.push({ rank, text, minor, lives });
	}
	return out;
}

// ---------- scripture ----------

const RE_READING =
	/<a[^>]+href="([^"]+\/reading[^"]*\/[^"]+\.htm)"[^>]*>([^<]+)<\/a>([^<]*)/g;

function parseScripture(block: string): ScriptureReading[] {
	if (block.length === 0) return [];
	const out: ScriptureReading[] = [];
	for (const m of block.matchAll(RE_READING)) {
		const href = m[1]!;
		const citation = stripTags(m[2]!);
		const noteRaw = stripTags(m[3]!.replace(/<br\s*\/?>/gi, " "));
		const reading: ScriptureReading =
			noteRaw.length > 0
				? { citation, href, note: noteRaw }
				: { citation, href };
		out.push(reading);
	}
	return out;
}

// ---------- troparia ----------

// The separator is a nested `<table>` construct carrying
// `class=troparionseparator` on an inner `<td>`. Rather than try to match
// the whole balanced markup, split on the class marker itself — no other
// content contains that literal, and we only pick `<p>` elements out of
// each group blob afterwards, so residual separator HTML is harmless.
const SEPARATOR_MARKER = "troparionseparator";

function parseTroparia(block: string): Hymn[] {
	if (block.length === 0) return [];
	// Split into groups on the separator marker.
	const groupBlobs = block.split(SEPARATOR_MARKER);
	const hymns: Hymn[] = [];
	for (let g = 0; g < groupBlobs.length; g++) {
		const blob = groupBlobs[g]!;
		// Split into <p>…</p> paragraphs.
		const paragraphs = [...blob.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(
			(m) => m[1]!,
		);
		let currentTitle: string | null = null;
		let currentText: string[] = [];
		const flush = (): void => {
			if (currentTitle === null) return;
			hymns.push({
				title: currentTitle,
				text: currentText.join("\n\n").trim(),
				group: g,
			});
			currentTitle = null;
			currentText = [];
		};
		for (const p of paragraphs) {
			const bMatch = /^\s*<b>([\s\S]*?)<\/b>\s*(?:<br\s*\/?>)?([\s\S]*)$/i.exec(
				p,
			);
			if (bMatch !== null) {
				flush();
				const title = stripTags(bMatch[1]!).replace(/\s*[—–-]\s*$/, "").trim();
				const rest = stripTags(bMatch[2]!);
				currentTitle = title;
				if (rest.length > 0) currentText.push(rest);
			} else if (currentTitle !== null) {
				const t = stripTags(p);
				if (t.length > 0) currentText.push(t);
			}
		}
		flush();
	}
	return hymns;
}

// ---------- driver ----------

async function parseOne(iso: string): Promise<DayRecord> {
	const html = await fetchDay(iso);
	const { civil, julian } = parseDataHeader(html);
	const { headerText, tone, fastText } = parseHeader(html);
	const commemorations = parseCommemorations(extractCommemorationsBlock(html));
	const scripture = parseScripture(extractScriptureBlock(html));
	const troparia = parseTroparia(extractTroparionBlock(html));
	return {
		civil,
		julian,
		headerText,
		tone,
		fastText,
		commemorations,
		scripture,
		troparia,
	};
}

function outPathFor(year: number): string {
	return resolve(OUT_DIR, `htoc-full-${year}.json`);
}

function loadCorpus(year: number): Corpus {
	const out = outPathFor(year);
	if (existsSync(out)) {
		try {
			const raw = readFileSync(out, "utf8");
			const parsed = JSON.parse(raw) as Corpus;
			process.stdout.write(
				`  loaded ${Object.keys(parsed.days).length} cached entries from ${out}\n`,
			);
			return parsed;
		} catch (e) {
			process.stderr.write(
				`  warning: could not parse ${out}: ${String(e)}\n`,
			);
		}
	}
	return {
		source: "https://www.holytrinityorthodox.com/calendar/",
		params: HTOC_PARAMS,
		year,
		fetchedAt: new Date().toISOString(),
		days: {},
	};
}

function saveCorpus(corpus: Corpus): void {
	if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
	const out = outPathFor(corpus.year);
	const next: Corpus = { ...corpus, fetchedAt: new Date().toISOString() };
	writeFileSync(out, `${JSON.stringify(next, null, "\t")}\n`, "utf8");
}

async function main(): Promise<void> {
	const { ranges, delay, refresh } = parseArgs(process.argv.slice(2));
	// Group requested dates by calendar year (civil ISO year).
	const byYear = new Map<number, string[]>();
	for (const r of ranges) {
		for (const iso of eachDay(r.from, r.to)) {
			const y = Number.parseInt(iso.slice(0, 4), 10);
			const list = byYear.get(y) ?? [];
			list.push(iso);
			byYear.set(y, list);
		}
	}
	const years = [...byYear.keys()].sort((a, b) => a - b);
	for (const year of years) {
		process.stdout.write(`year ${year}:\n`);
		const corpus = loadCorpus(year);
		const days = { ...corpus.days };
		let fetched = 0;
		let skipped = 0;
		let errors = 0;
		const dates = byYear.get(year)!;
		for (let i = 0; i < dates.length; i++) {
			const iso = dates[i]!;
			if (!refresh && days[iso] !== undefined) {
				skipped++;
				continue;
			}
			try {
				const day = await parseOne(iso);
				days[iso] = day;
				fetched++;
				if (fetched % 25 === 0 || i === dates.length - 1) {
					process.stdout.write(
						`  ${iso}  jul=${day.julian.year}-${String(day.julian.month).padStart(2, "0")}-${String(day.julian.day).padStart(2, "0")}  tone=${day.tone ?? "-"}  comms=${day.commemorations.length}  reads=${day.scripture.length}  trop=${day.troparia.length}\n`,
					);
					// Periodic checkpoint so a crash doesn't lose everything.
					saveCorpus({ ...corpus, days });
				}
				await sleep(delay);
			} catch (e) {
				errors++;
				process.stderr.write(`  ${iso}  ERROR: ${String(e)}\n`);
			}
		}
		saveCorpus({ ...corpus, days });
		process.stdout.write(
			`  wrote ${Object.keys(days).length} entries (${fetched} new, ${skipped} cached, ${errors} errors) to ${outPathFor(year)}\n`,
		);
	}
}

await main();
