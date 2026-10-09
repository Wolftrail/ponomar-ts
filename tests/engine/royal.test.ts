import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveDay } from "../../src/engine/day.ts";
import { composeRoyalHours } from "../../src/engine/hours.ts";
import { describeNode, fingerprint, orDash } from "./traceDescribe.ts";

const [header, ...lines] = readFileSync(new URL("../fixtures/golden/royal.tsv", import.meta.url), "utf8").replace(/\r?\n$/, "").split(/\r?\n/);
const names = header!.split("\t");
const rows = lines.map((line) => Object.fromEntries(line.split("\t").map((cell, i) => [names[i]!, cell])) as Record<string, string>);

test("the Royal Hours are served and composed as the upstream engine does", async () => {
	assert.ok(rows.length > 10000, `the fixture holds only ${rows.length} rows`);
	const failures: string[] = [];
	let served = 0;
	for (const row of rows) {
		const language = row["language"]!;
		const where = `${language} ${row["year"]}-${row["month"]}-${row["day"]}`;
		const day = await resolveDay({ date: { year: Number(row["year"]), month: Number(row["month"]), day: Number(row["day"]) }, language });
		const service = await composeRoyalHours(day, language);
		const got = [service.type === "RoyalHours" ? "1" : "0", orDash(service.flags.PFlag), String(service.nodes.length), fingerprint(service.nodes.map(describeNode).join("\n"))].join("\t");
		const expected = [row["served"], row["PFlag"], row["lines"], row["trace"]].join("\t");
		served += service.type === "RoyalHours" ? 1 : 0;
		if (got !== expected) {
			failures.push(`${where}: ${got} (upstream ${expected})`);
		}
	}
	assert.ok(served > 80, `only ${served} services compared`);
	assert.equal(failures.length, 0, `${failures.length} differences:\n${failures.slice(0, 12).join("\n")}`);
});
