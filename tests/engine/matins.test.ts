import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import type { GospelScheme } from "../../src/engine/context.ts";
import { resolveDay } from "../../src/engine/day.ts";
import type { LiturgyReading } from "../../src/engine/liturgy.ts";
import { getMatinsReadings } from "../../src/engine/matins.ts";

interface Row {
	language: string;
	gs: GospelScheme;
	year: number;
	month: number;
	day: number;
	matins: string;
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
			matins: cells["matins"] ?? "",
		};
	});
}

/** The oracle's "reading~rank~tag|..." form without the placeholders upstream keeps for commemorations lacking a reading. */
function describe(readings: readonly LiturgyReading[]): string {
	return readings.map((r) => `${r.reading}~${r.rank}~${r.weekday ?? r.commemoration}`).join("|");
}

function expectedOf(cell: string): string {
	return cell
		.split("|")
		.filter((item) => item !== "" && !item.startsWith("~"))
		.join("|");
}

async function compare(rows: readonly Row[]): Promise<string[]> {
	const failures: string[] = [];
	for (const row of rows) {
		const day = await resolveDay({ date: { year: row.year, month: row.month, day: row.day }, language: row.language, gospelScheme: row.gs });
		const got = describe(await getMatinsReadings(day, row.language));
		const expected = row.matins === "-" ? "" : expectedOf(row.matins);
		if (got !== expected) {
			failures.push(`${row.language} gs${row.gs} ${row.year}-${row.month}-${row.day}: ${got || "(none)"} (upstream ${expected || "(none)"})`);
		}
	}
	return failures;
}

const sample = load(new URL("../fixtures/golden/matins.tsv", import.meta.url));
const fullPath = new URL("../../scratch/golden/matins.tsv", import.meta.url);

test("matins readings agree with the upstream engine on sampled days", async () => {
	assert.ok(sample.length > 2500, `the sampled fixture holds only ${sample.length} days`);
	const failures = await compare(sample);
	assert.equal(failures.length, 0, `${failures.length} differences in ${sample.length} days:\n${failures.slice(0, 12).join("\n")}`);
});

test("matins readings agree with the upstream engine on every day", { skip: !existsSync(fullPath) }, async () => {
	const rows = load(fullPath);
	const failures = await compare(rows);
	assert.equal(failures.length, 0, `${failures.length} differences in ${rows.length} days:\n${failures.slice(0, 12).join("\n")}`);
});
