// Load the scraped HTOC corpus (`tests/fixtures/full-<YEAR>.json`)
// for a fixed list of years. Shared by every script under
// `scripts/analysis/`. Read-only utility — no engine imports.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface LivesLink {
	readonly name: string;
	readonly href: string;
}

export interface Commemoration {
	readonly rank: string;
	readonly text: string;
	readonly minor: boolean;
	readonly lives: readonly LivesLink[];
}

export interface ScriptureReading {
	readonly citation: string;
	readonly href: string;
	readonly note?: string;
}

export interface Hymn {
	readonly title: string;
	readonly text: string;
	readonly group: number;
}

export interface Day {
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
	readonly commemorations: readonly Commemoration[];
	readonly scripture: readonly ScriptureReading[];
	readonly troparia: readonly Hymn[];
}

export interface Corpus {
	readonly source: string;
	readonly params: string;
	readonly year: number;
	readonly fetchedAt: string;
	readonly days: Record<string, Day>;
}

export const YEARS = [2025, 2026, 2027, 2028, 2029, 2030] as const;

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = resolve(HERE, "..", "..", "tests", "fixtures");
export const SCRATCH_DIR = resolve(HERE, "..", "..", "scratch");

export function loadYear(year: number): Corpus {
	const path = resolve(FIXTURES_DIR, `full-${year}.json`);
	const raw = readFileSync(path, "utf8");
	return JSON.parse(raw) as Corpus;
}

export interface CorpusEntry {
	readonly iso: string;
	readonly day: Day;
}

/** Iterate every day across `YEARS` in ISO-sorted order. */
export function* iterCorpus(): Generator<CorpusEntry> {
	for (const y of YEARS) {
		const c = loadYear(y);
		const isoSorted = Object.keys(c.days).sort();
		for (const iso of isoSorted) {
			yield { iso, day: c.days[iso]! };
		}
	}
}
