import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { findDayFile } from "../../src/data/access.ts";
import { type ResolvedPart, resolveDay } from "../../src/engine/day.ts";
import type { GospelScheme } from "../../src/engine/context.ts";

interface Row {
	language: string;
	gs: GospelScheme;
	year: number;
	month: number;
	day: number;
	fields: Record<string, string>;
}

const VARIABLES = ["nday", "ndayP", "ndayF", "doy", "dow"];

function load(path: URL): Row[] {
	const [header, ...lines] = readFileSync(path, "utf8").trim().split(/\r?\n/);
	const names = header!.split("\t");
	return lines.map((line) => {
		const fields = Object.fromEntries(line.split("\t").map((cell, i) => [names[i]!, cell]));
		return {
			language: fields["language"]!,
			gs: Number(fields["gs"]) as GospelScheme,
			year: Number(fields["year"]),
			month: Number(fields["month"]),
			day: Number(fields["day"]),
			fields,
		};
	});
}

/** "sid:cid:rank|..." with whitespace trimmed around ids: the converter trims, upstream keeps stray spaces. */
function canonical(entries: string): string {
	return entries
		.split("|")
		.map((entry) => {
			const [sid, cid, rank] = entry.split(":");
			return `${(sid ?? "").split(",").map((id) => id.trim()).join(",")}:${(cid ?? "").trim()}:${rank}`;
		})
		.join("|");
}

/** The oracle prints SId as upstream stores it: "1" when the day file gives none. */
function describe(part: ResolvedPart): string {
	return part.commemorations.map((c) => `${c.sid.length === 0 ? "1" : c.sid.join(",")}:${c.cid}:${c.rank}`).join("|");
}

async function compare(rows: readonly Row[]): Promise<string[]> {
	const failures: string[] = [];
	for (const row of rows) {
		const resolved = await resolveDay({ date: { year: row.year, month: row.month, day: row.day }, language: row.language, gospelScheme: row.gs });
		const file = `xml/${resolved.paschal.cycle}/${String(resolved.paschal.file).padStart(2, "0")}`;
		const actual: Record<string, string> = {
			...Object.fromEntries(VARIABLES.map((n) => [n, String(resolved.variables[n])])),
			paschalFile: file,
			paschal: canonical(describe(resolved.paschal)),
			menaion: canonical(describe(resolved.menaion)),
			rankPaschal: String(resolved.paschal.rank),
			rankMenaion: String(resolved.menaion.rank),
			dRank: String(resolved.rank),
			tone: String(resolved.tone),
		};
		const diffs = Object.entries(actual)
			.filter(([name, value]) => value !== (name === "paschal" || name === "menaion" ? canonical(row.fields[name]!) : row.fields[name]))
			.map(([name]) => name);
		if (diffs.length > 0) {
			failures.push(`${row.language} gs${row.gs} ${row.year}-${row.month}-${row.day}: ${diffs.join(", ")}`);
		}
	}
	return failures;
}

const sample = load(new URL("../fixtures/golden/day.tsv", import.meta.url));
const fullPath = new URL("../../scratch/golden/day.tsv", import.meta.url);

test("day resolution agrees with the upstream engine on sampled days", async () => {
	const failures = await compare(sample);
	assert.equal(failures.length, 0, `${failures.length} of ${sample.length} days differ:\n${failures.slice(0, 12).join("\n")}`);
});

test("day resolution agrees with the upstream engine on every day", { skip: !existsSync(fullPath) }, async () => {
	const rows = load(fullPath);
	const failures = await compare(rows);
	assert.equal(failures.length, 0, `${failures.length} of ${rows.length} days differ:\n${failures.slice(0, 12).join("\n")}`);
});

test("file selection follows the distance from Pascha", async () => {
	const at = async (year: number, month: number, day: number): Promise<[string, string | number]> => {
		const part = (await resolveDay({ date: { year, month, day }, language: "en" })).paschal;
		return [part.cycle, part.file];
	};
	// Pascha 2026 is Julian 30 March.
	assert.deepEqual(await at(2026, 3, 30), ["pentecostarion", 1]);
	assert.deepEqual(await at(2026, 3, 29), ["triodion", 1]);
	assert.deepEqual(await at(2026, 1, 19), ["triodion", 70]);
	assert.equal((await at(2026, 1, 18))[0], "pentecostarion");
});

test("missing day files are undefined and fall back along the language chain", async () => {
	assert.equal(await findDayFile("menaion", "en", "13-40"), undefined);
	assert.equal(await findDayFile("pentecostarion", "en", 316), undefined);
	// cu/ru has no menaion of its own, so it reads cu's; en has its own, which differs from the root's.
	assert.equal(await findDayFile("menaion", "cu/ru", "03-01"), await findDayFile("menaion", "cu", "03-01"));
	assert.notEqual(await findDayFile("menaion", "en", "01-01"), await findDayFile("menaion", "", "01-01"));
	// Greek has no pentecostarion file 1 of its own beyond the few it defines, so the root's is used.
	assert.equal(await findDayFile("pentecostarion", "el/mono", 1), await findDayFile("pentecostarion", "", 1));
});

test("ranks come from lives along the chain and the day rank is the highest", async () => {
	// Pascha itself: the Pentecostarion's first day is the highest rank in the cycle.
	const pascha = await resolveDay({ date: { year: 2026, month: 3, day: 30 }, language: "en" });
	assert.equal(pascha.rank, Math.max(pascha.paschal.rank, pascha.menaion.rank));
	assert.ok(pascha.paschal.rank >= 7, `Pascha ranks ${pascha.paschal.rank}`);
	// Movable-cycle commemorations without a rank are -2.
	const ordinary = await resolveDay({ date: { year: 2026, month: 1, day: 3 }, language: "en" });
	assert.ok(ordinary.paschal.commemorations.every((c) => c.cid.length !== 4 || c.rank <= 1));
});
