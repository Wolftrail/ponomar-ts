import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveDay } from "../../src/engine/day.ts";
import { composeHour, type HourName, type ServiceParts, type ServiceWho } from "../../src/engine/hours.ts";
import { describeNode, fingerprint, orDash } from "./traceDescribe.ts";

const [header, ...lines] = readFileSync(new URL("../fixtures/golden/hours.tsv", import.meta.url), "utf8").replace(/\r?\n$/, "").split(/\r?\n/);
const names = header!.split("\t");
const rows = lines.map((line) => Object.fromEntries(line.split("\t").map((cell, i) => [names[i]!, cell])) as Record<string, string>);

const WHO: Readonly<Record<string, ServiceWho>> = { Reader: "reader", Priest: "priest" };
const PARTS: Readonly<Record<string, ServiceParts>> = {
	Independent: "independent",
	"W.Beginning": "withoutBeginning",
	"W.Ending": "withoutEnding",
	"W.BeginningEnding": "withoutBeginningOrEnding",
};

test("the hours compose as the upstream engine does", async () => {
	assert.ok(rows.length > 4000, `the fixture holds only ${rows.length} rows`);
	const failures: string[] = [];
	const compared: Record<string, number> = {};
	for (const row of rows) {
		// Upstream stops on days whose files name a commemoration it cannot rank (the French 050307;).
		if (row["type"] === "ERR") {
			continue;
		}
		const hour = row["hour"] as HourName;
		const language = row["language"]!;
		const where = `${language} ${row["year"]}-${row["month"]}-${row["day"]} ${hour} ${row["who"]}/${row["parts"]}`;
		const day = await resolveDay({ date: { year: Number(row["year"]), month: Number(row["month"]), day: Number(row["day"]) }, language });
		const service = await composeHour(hour, day, language, { who: WHO[row["who"]!]!, parts: PARTS[row["parts"]!]! });
		if (service.type === undefined) {
			// No rule for the day: upstream fails with a null type, before it sets any flag.
			assert.equal(row["PFlag1"], "-", where);
			continue;
		}
		const trace = service.nodes.map(describeNode).join("\n");
		const got = [service.type, orDash(service.flags.PS), orDash(service.flags.PFlag1), orDash(service.flags.PFlag2), orDash(service.flags.PFlag3), String(service.nodes.length), fingerprint(trace)].join("\t");
		const expected = [row["type"], row["PS"], row["PFlag1"], row["PFlag2"], row["PFlag3"], row["lines"], row["trace"]].join("\t");
		compared[hour] = (compared[hour] ?? 0) + 1;
		if (got !== expected) {
			failures.push(`${where}: ${got} (upstream ${expected})`);
		}
	}
	for (const hour of ["primes", "terce", "sexte", "none"]) {
		assert.ok((compared[hour] ?? 0) > 700, `${hour}: only ${compared[hour] ?? 0} services compared`);
	}
	assert.equal(failures.length, 0, `${failures.length} differences:\n${failures.slice(0, 12).join("\n")}`);
});
