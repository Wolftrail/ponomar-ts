// Fetch daily Divine Liturgy readings from holytrinityorthodox.com's calendar
// for a Gregorian date range and write them to a JSON fixture. The scraped
// corpus is used to reverse-engineer HTOC's Gospel-cycle rubric (which differs
// from the vendored Ponomar XML around the Markan bridge).
//
// Usage:
//   node --experimental-strip-types scripts/scrape-htoc.ts \
//       --from 2026-09-01 --to 2026-10-15 [--out path] [--delay 500]
//
// Idempotent: existing entries in the output file are preserved; only missing
// dates are fetched. Output is not committed (see .gitignore) — this exists
// purely as a research aid.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

interface Reading {
	/** Raw path within the site, e.g. `2/a114`, `p/p050-01`, `ae/e09151-01`. */
	readonly code: string;
	/** Reading text as displayed, e.g. `Ephesians 5:20-26`. */
	readonly text: string;
	/** Trailing annotation, e.g. `(6th Hour)`, `St. Demetrius`, `Gospel`. */
	readonly note?: string;
}

interface DayRecord {
	readonly julian: string;
	readonly weekLabel: string | null;
	readonly tone: number | null;
	/** Every `<a href="reading…">` link inside the Scripture Readings block,
	 *  in document order. Classification into apostol/gospel/matins/festal/…
	 *  is done downstream by URL prefix, not here. */
	readonly readings: readonly Reading[];
}

interface Corpus {
	readonly source: string;
	readonly fetchedAt: string;
	readonly days: Record<string, DayRecord>;
}

const HTOC_BASE = "https://www.holytrinityorthodox.com/calendar/index.php";
const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = resolve(HERE, "..", "tests", "fixtures", "htoc.json");

function parseArgs(argv: readonly string[]): {
	from: string;
	to: string;
	out: string;
	delay: number;
	refresh: boolean;
} {
	let from: string | null = null;
	let to: string | null = null;
	let out = DEFAULT_OUT;
	let delay = 500;
	let refresh = false;
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		const v = argv[i + 1];
		if (a === "--from" && v !== undefined) {
			from = v;
			i++;
		} else if (a === "--to" && v !== undefined) {
			to = v;
			i++;
		} else if (a === "--out" && v !== undefined) {
			out = resolve(v);
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
	if (from === null || to === null) {
		throw new Error("required: --from YYYY-MM-DD --to YYYY-MM-DD");
	}
	return { from, to, out, delay, refresh };
}

function eachDay(from: string, to: string): string[] {
	const start = new Date(`${from}T00:00:00Z`);
	const end = new Date(`${to}T00:00:00Z`);
	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
		throw new Error(`bad date: from=${from} to=${to}`);
	}
	const out: string[] = [];
	for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
		const d = new Date(t);
		const iso = d.toISOString().slice(0, 10);
		out.push(iso);
	}
	return out;
}

function urlFor(iso: string): string {
	const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
	if (y === undefined || m === undefined || d === undefined) {
		throw new Error(`bad iso: ${iso}`);
	}
	// trp=0 suppresses troparia (smaller payload). tzo=-4 avoids the JS
	// redirect stub the site emits when tzo is absent.
	const qs = `year=${y}&month=${m}&today=${d}&trp=0&tzo=-4`;
	return `${HTOC_BASE}?${qs}`;
}

async function fetchDay(iso: string): Promise<string> {
	const res = await fetch(urlFor(iso), {
		headers: {
			"User-Agent":
				"ponomar-ts research scraper (https://github.com/wolfgangnothdurft/ponomar-ts)",
		},
	});
	if (!res.ok) {
		throw new Error(`HTTP ${res.status} for ${iso}`);
	}
	// The site declares windows-1251 in a meta tag, but the Scripture Readings
	// block is ASCII, so treating the body as UTF-8 is fine for our fields.
	return await res.text();
}

const RE_JULIAN =
	/([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})\s+<span[^>]*>\s*\(Church Calendar\)/;
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

function parseJulian(html: string): string {
	const m = RE_JULIAN.exec(html);
	if (m === null) throw new Error("julian date not found in page");
	const mon = MONTHS[m[1]!];
	if (mon === undefined) throw new Error(`bad month: ${m[1]}`);
	const day = Number.parseInt(m[2]!, 10);
	const year = Number.parseInt(m[3]!, 10);
	return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const RE_TONE = /\bTone\s+([a-z]+)\b/i;
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

function parseWeekTone(html: string): {
	weekLabel: string | null;
	tone: number | null;
} {
	const toneMatch = RE_TONE.exec(html);
	if (toneMatch === null) return { weekLabel: null, tone: null };
	const tone = TONE_WORDS[toneMatch[1]!.toLowerCase()] ?? null;
	// Take the ~200 chars immediately before "Tone", strip tags, and keep the
	// last non-empty sentence — that's the week/day label. Attribute text
	// from tags whose opening `<` fell outside the window can leak in;
	// discard anything up to the last stray `>` to be safe.
	const start = Math.max(0, toneMatch.index - 200);
	const pre = html
		.slice(start, toneMatch.index)
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	const afterStray = pre.slice(pre.lastIndexOf(">") + 1);
	const label =
		afterStray
			.split(".")
			.map((s) => s.trim())
			.filter((s) => s.length > 0)
			.pop() ?? null;
	return { weekLabel: label, tone };
}

function extractReadingsBlock(html: string): string {
	const start = html.indexOf("Scripture Readings");
	if (start < 0) return "";
	// The block ends at the "SHOW/HIDE TROPARIA" toggle, or (if troparia are
	// hidden) at the closing </span></td>. Take everything up to whichever
	// comes first. Falling back to a large window is safe — the regex below
	// only picks reading anchors.
	const enders = [
		html.indexOf("SHOW TROPARIA", start),
		html.indexOf("HIDE TROPARIA", start),
		html.indexOf("</span></td>", start),
	].filter((i) => i > 0);
	const end = enders.length === 0 ? start + 8000 : Math.min(...enders);
	return html.slice(start, end);
}

// Match any `<a href="…reading…/…\.htm">TEXT</a>` link, then greedily grab
// the trailing free-text annotation up to the next `<br>`, `<a `, or `<p>`.
// The path is captured in group 1 (without the trailing `.htm`).
const RE_READING_LINK =
	/href="((?:reading\/[^"/]+\/[^"]+|reading2\/[^"/]+\/[^"]+))\.htm"[^>]*>([^<]+)<\/a>([^<]*)/g;

function parseReadings(html: string): Reading[] {
	const block = extractReadingsBlock(html);
	const out: Reading[] = [];
	for (const m of block.matchAll(RE_READING_LINK)) {
		// Normalize the path: `reading/2/a114` -> `2/a114`,
		// `reading2/ae/e09151-01` -> `ae/e09151-01`. The site-path prefix
		// (`2/`, `p/`, `ae/`) is preserved so downstream can classify.
		const code = m[1]!
			.replace(/^reading\//, "")
			.replace(/^reading2\//, "");
		const text = m[2]!.trim();
		const noteRaw = m[3]!
			.replace(/&nbsp;/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		const note = noteRaw.length > 0 ? noteRaw : undefined;
		out.push(note === undefined ? { code, text } : { code, text, note });
	}
	return out;
}

async function main(): Promise<void> {
	const { from, to, out, delay, refresh } = parseArgs(process.argv.slice(2));
	const dates = eachDay(from, to);

	let corpus: Corpus = {
		source: "https://www.holytrinityorthodox.com/calendar/",
		fetchedAt: new Date().toISOString(),
		days: {},
	};
	if (existsSync(out)) {
		try {
			const raw = readFileSync(out, "utf8");
			corpus = JSON.parse(raw) as Corpus;
			process.stdout.write(
				`loaded ${Object.keys(corpus.days).length} existing entries from ${out}\n`,
			);
		} catch (e) {
			process.stderr.write(`warning: could not parse ${out}: ${String(e)}\n`);
		}
	}

	const days = { ...corpus.days };
	let fetched = 0;
	let skipped = 0;
	for (const iso of dates) {
		if (!refresh && days[iso] !== undefined) {
			skipped++;
			continue;
		}
		try {
			const html = await fetchDay(iso);
			const julian = parseJulian(html);
			const { weekLabel, tone } = parseWeekTone(html);
			const readings = parseReadings(html);
			days[iso] = { julian, weekLabel, tone, readings };
			fetched++;
			process.stdout.write(
				`  ${iso}  jul=${julian}  reads=${readings.map((r) => r.code).join(",") || "-"}\n`,
			);
			await sleep(delay);
		} catch (e) {
			process.stderr.write(`  ${iso}  ERROR: ${String(e)}\n`);
		}
	}

	const outDir = dirname(out);
	if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
	const next: Corpus = {
		source: corpus.source,
		fetchedAt: new Date().toISOString(),
		days,
	};
	writeFileSync(out, `${JSON.stringify(next, null, "\t")}\n`, "utf8");
	process.stdout.write(
		`wrote ${Object.keys(days).length} entries (${fetched} new, ${skipped} cached) to ${out}\n`,
	);
}

await main();
