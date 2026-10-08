import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import type { GospelScheme } from "../../src/engine/context.ts";
import { resolveDay } from "../../src/engine/day.ts";
import { getLiturgyReadings, type LiturgyReading } from "../../src/engine/liturgy.ts";

interface Row {
	language: string;
	gs: GospelScheme;
	year: number;
	month: number;
	day: number;
	apostol: string;
	gospel: string;
}

function load(path: URL): Row[] {
	const [header, ...lines] = readFileSync(path, "utf8").replace(/\r?\n$/, "").split(/\r?\n/);
	const names = header!.split("\t");
	return lines.map((line) => {
		const cells = Object.fromEntries(line.split("\t").map((cell, i) => [names[i]!, cell]));
		return {
			language: cells["language"]!,
			gs: Number(cells["gs"]) as GospelScheme,
			year: Number(cells["year"]),
			month: Number(cells["month"]),
			day: Number(cells["day"]),
			apostol: cells["apostol"] ?? "",
			gospel: cells["gospel"] ?? "",
		};
	});
}

/** The oracle's "reading~rank~tag|..." form; "-" (type not shown) and "" (nothing left to show) both mean no readings. */
function describe(readings: readonly LiturgyReading[]): string {
	return readings.map((r) => `${r.reading}~${r.rank}~${r.weekday ?? r.commemoration}`).join("|");
}

async function compare(rows: readonly Row[]): Promise<string[]> {
	const failures: string[] = [];
	for (const row of rows) {
		const day = await resolveDay({ date: { year: row.year, month: row.month, day: row.day }, language: row.language, gospelScheme: row.gs });
		const actual = await getLiturgyReadings(day, row.language);
		for (const type of ["apostol", "gospel"] as const) {
			const expected = row[type] === "-" ? "" : row[type];
			const got = describe(actual[type]);
			if (got !== expected) {
				failures.push(`${row.language} gs${row.gs} ${row.year}-${row.month}-${row.day} ${type}: ${got || "(none)"} (upstream ${expected || "(none)"})`);
			}
		}
	}
	return failures;
}

const sample = load(new URL("../fixtures/golden/liturgy.tsv", import.meta.url));
const fullPath = new URL("../../scratch/golden/liturgy.tsv", import.meta.url);

test("liturgy readings agree with the upstream engine on sampled days", async () => {
	assert.ok(sample.length > 2500, `the sampled fixture holds only ${sample.length} days`);
	const failures = await compare(sample);
	assert.equal(failures.length, 0, `${failures.length} differences in ${sample.length} days:\n${failures.slice(0, 12).join("\n")}`);
});

test("liturgy readings agree with the upstream engine on every day", { skip: !existsSync(fullPath) }, async () => {
	const rows = load(fullPath);
	const failures = await compare(rows);
	assert.equal(failures.length, 0, `${failures.length} differences in ${rows.length} days:\n${failures.slice(0, 12).join("\n")}`);
});
