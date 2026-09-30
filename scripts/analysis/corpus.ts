// Load the scraped HTOC corpus (`tests/fixtures/htoc-full-<YEAR>.json`)
// for a fixed list of years. Shared by every script under
// `scripts/analysis/`. Read-only utility — no engine imports.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface HtocLivesLink {
	readonly name: string;
	readonly href: string;
}

export interface HtocCommemoration {
	readonly rank: string;
	readonly text: string;
	readonly minor: boolean;
	readonly lives: readonly HtocLivesLink[];
}

export interface HtocScriptureReading {
	readonly citation: string;
	readonly href: string;
	readonly note?: string;
}

export interface HtocHymn {
	readonly title: string;
	readonly text: string;
	readonly group: number;
}

export interface HtocDay {
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
	readonly headerText: string;
	readonly tone: number | null;
	readonly fastText: string | null;
	readonly commemorations: readonly HtocCommemoration[];
	readonly scripture: readonly HtocScriptureReading[];
	readonly troparia: readonly HtocHymn[];
}

export interface HtocCorpus {
	readonly source: string;
	readonly params: string;
	readonly year: number;
	readonly fetchedAt: string;
	readonly days: Record<string, HtocDay>;
}

export const HTOC_YEARS = [2025, 2026, 2027] as const;

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = resolve(HERE, "..", "..", "tests", "fixtures");
export const SCRATCH_DIR = resolve(HERE, "..", "..", "scratch");

export function loadYear(year: number): HtocCorpus {
	const path = resolve(FIXTURES_DIR, `htoc-full-${year}.json`);
	const raw = readFileSync(path, "utf8");
	return JSON.parse(raw) as HtocCorpus;
}

export interface CorpusEntry {
	readonly iso: string;
	readonly day: HtocDay;
}

/** Iterate every day across `HTOC_YEARS` in ISO-sorted order. */
export function* iterCorpus(): Generator<CorpusEntry> {
	for (const y of HTOC_YEARS) {
		const c = loadYear(y);
		const isoSorted = Object.keys(c.days).sort();
		for (const iso of isoSorted) {
			yield { iso, day: c.days[iso]! };
		}
	}
}
