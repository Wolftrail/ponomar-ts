import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatNumber } from "../../src/engine/numbers.ts";

const [header, ...lines] = readFileSync(new URL("../fixtures/golden/numbers.tsv", import.meta.url), "utf8").replace(/\r?\n$/, "").split(/\r?\n/);
assert.equal(header, "language\tnumber\ttext");
const rows = lines.map((line) => {
	const [language, number, ...text] = line.split("\t");
	return { language: language!, number: Number(number), text: text.join("\t") };
});

const clean = (text: string): string => text.replace(/[\t\r\n]/g, " ");

test("numbers agree with the upstream engine in every language", async () => {
	assert.ok(rows.length > 30000, `the fixture holds only ${rows.length} rows`);
	const failures: string[] = [];
	for (const row of rows) {
		let got: string;
		try {
			got = clean(await formatNumber(row.language, row.number));
		} catch (error) {
			got = `ERR (${(error as Error).message})`;
		}
		if (got !== row.text) {
			failures.push(`${row.language || "(root)"} ${row.number}: ${got} (upstream ${row.text})`);
		}
	}
	assert.equal(failures.length, 0, `${failures.length} differences:\n${failures.slice(0, 15).join("\n")}`);
});
