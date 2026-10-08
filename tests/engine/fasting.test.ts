import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { describeFastingLevel, getFasting, getFastingLevel, renderFastingLevel } from "../../src/engine/fasting.ts";
import { resolveDay } from "../../src/engine/day.ts";

function loadTsv(path: URL): Record<string, string>[] {
	// Only the final newline is removed: a sentence may legitimately end in a space.
	const [header, ...lines] = readFileSync(path, "utf8").replace(/\r?\n$/, "").split(/\r?\n/);
	const names = header!.split("\t");
	return lines.map((line) => Object.fromEntries(line.split("\t").map((cell, i) => [names[i]!, cell])));
}

async function levelFor(row: Record<string, string>): Promise<{ level: string | undefined; dRank: number }> {
	const day = await resolveDay({
		date: { year: Number(row["year"]), month: Number(row["month"]), day: Number(row["day"]) },
		language: row["language"]!,
		gospelScheme: Number(row["gs"]) as 0 | 1,
	});
	return { level: getFastingLevel({ ...day.variables, dRank: day.rank }), dRank: day.rank };
}

const sample = loadTsv(new URL("../fixtures/golden/day.tsv", import.meta.url));
const fullPath = new URL("../../scratch/golden/day.tsv", import.meta.url);

async function compareLevels(rows: Record<string, string>[]): Promise<string[]> {
	const failures: string[] = [];
	for (const row of rows) {
		const { level } = await levelFor(row);
		if (level !== row["fastLevel"]) {
			failures.push(`${row["language"]} gs${row["gs"]} ${row["year"]}-${row["month"]}-${row["day"]}: ${level} (upstream ${row["fastLevel"]})`);
		}
		const text = level === undefined ? undefined : await renderFastingLevel(level, row["language"]!);
		if (text !== row["fastText"]) {
			failures.push(`${row["language"]} ${row["year"]}-${row["month"]}-${row["day"]}: text "${text}" (upstream "${row["fastText"]}")`);
		}
	}
	return failures;
}

test("fasting level and sentence agree with the upstream engine on sampled days", async () => {
	const failures = await compareLevels(sample);
	assert.equal(failures.length, 0, `${failures.length} differences:\n${failures.slice(0, 10).join("\n")}`);
});

test("fasting level and sentence agree with the upstream engine on every day", { skip: !existsSync(fullPath) }, async () => {
	const failures = await compareLevels(loadTsv(fullPath));
	assert.equal(failures.length, 0, `${failures.length} differences:\n${failures.slice(0, 10).join("\n")}`);
});

test("sentences agree with upstream for every possible level in six languages", async () => {
	const rows = loadTsv(new URL("../fixtures/golden/fastconvert.tsv", import.meta.url));
	assert.equal(rows.length, 6 * 128);
	const failures: string[] = [];
	for (const row of rows) {
		const text = await renderFastingLevel(row["level"]!, row["language"]!);
		if (text !== row["text"]) {
			failures.push(`${row["language"]} ${row["level"]}: "${text}" (upstream "${row["text"]}")`);
		}
	}
	assert.equal(failures.length, 0, `${failures.length} differences:\n${failures.slice(0, 10).join("\n")}`);
});

test("levels decode into permitted and forbidden foods", () => {
	assert.deepEqual(describeFastingLevel("0000111"), {
		level: "0000111",
		permitted: ["oil", "wine", "dryFood"],
		forbidden: ["meat", "dairy", "fish", "caviar"],
	});
	assert.deepEqual(describeFastingLevel("1111111").forbidden, []);
	assert.deepEqual(describeFastingLevel("0000000").permitted, []);
});

test("Great Lent and the ordinary year follow the Typikon rules", () => {
	const lent = { nday: -40, dow: 3, doy: 62, dRank: 0 };
	assert.equal(getFastingLevel(lent), "0000001");
	assert.equal(getFastingLevel({ ...lent, dow: 6 }), "0000111");
	assert.equal(getFastingLevel({ nday: -48, dow: 1, doy: 70, dRank: 0 }), "0000000");
	assert.equal(getFasting({ nday: 3, dow: 2, doy: 100, dRank: 8 })?.level, "1111111");
	// Ordinary time: Wednesday fasts, Tuesday does not.
	assert.equal(getFastingLevel({ nday: 100, dow: 3, doy: 200, dRank: 0 }), "0000001");
	assert.equal(getFastingLevel({ nday: 100, dow: 2, doy: 200, dRank: 0 }), "1111111");
});
