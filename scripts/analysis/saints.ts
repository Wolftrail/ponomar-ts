// Extract every unique Life-of-Saint link from the scraped HTOC corpus
// (`tests/fixtures/full-<year>.json`). Deduplicated by href; each
// record keeps the distinct display names seen and the sorted ISO dates
// on which the link appeared. Writes `scratch/saints.json`.
//
// Usage:
//   node --experimental-strip-types scripts/analysis/saints.ts

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { YEARS, SCRATCH_DIR, iterCorpus } from "./corpus.ts";

interface SaintEntry {
	readonly href: string;
	// HTOC hosts fixed-calendar Lives under `/los/<Month>/…` and movable
	// (Paschal-cycle) Lives under `/los/Epiphany/…`.
	readonly cycle: "fixed" | "movable";
	readonly names: readonly string[];
	// Distinct rank glyphs (`0`, `1`, `2`, `o`, `r`, ...) inherited from the
	// parent commemoration on every date the link appeared.
	readonly ranks: readonly string[];
	// Distinct parent-commemoration `text` values seen; usually a single
	// string, plural only when wording varies day-to-day.
	readonly texts: readonly string[];
	readonly dates: readonly string[];
}

interface Accumulator {
	href: string;
	names: Set<string>;
	ranks: Set<string>;
	texts: Set<string>;
	dates: Set<string>;
}

const byHref = new Map<string, Accumulator>();

for (const { iso, day } of iterCorpus()) {
	for (const comm of day.commemorations) {
		for (const link of comm.lives) {
			let entry = byHref.get(link.href);
			if (!entry) {
				entry = {
					href: link.href,
					names: new Set(),
					ranks: new Set(),
					texts: new Set(),
					dates: new Set(),
				};
				byHref.set(link.href, entry);
			}
			entry.names.add(link.name);
			entry.ranks.add(comm.rank);
			entry.texts.add(comm.text);
			entry.dates.add(iso);
		}
	}
}

const saints: SaintEntry[] = [...byHref.values()]
	.map((e) => ({
		href: e.href,
		cycle: classifyCycle(e.href),
		names: [...e.names].sort(),
		ranks: [...e.ranks].sort(),
		texts: [...e.texts].sort(),
		dates: [...e.dates].sort(),
	}))
	.sort((a, b) => (a.href < b.href ? -1 : a.href > b.href ? 1 : 0));

function classifyCycle(href: string): "fixed" | "movable" {
	return /\/los\/Epiphany\//.test(href) ? "movable" : "fixed";
}

if (!existsSync(SCRATCH_DIR)) mkdirSync(SCRATCH_DIR, { recursive: true });

const outPath = resolve(SCRATCH_DIR, "saints.json");
const payload = {
	source: "tests/fixtures/full-<year>.json",
	years: [...YEARS],
	generatedAt: new Date().toISOString(),
	count: saints.length,
	saints,
};

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
const fixed = saints.filter((s) => s.cycle === "fixed").length;
const movable = saints.length - fixed;
console.log(
	`Wrote ${saints.length} unique saints ` +
		`(${fixed} fixed, ${movable} movable) to scratch/saints.json`,
);
