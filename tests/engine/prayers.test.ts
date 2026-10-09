import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getPrayerText } from "../../src/data/services.ts";

const [header, ...lines] = readFileSync(new URL("../fixtures/golden/texts.tsv", import.meta.url), "utf8").replace(/\r?\n$/, "").split(/\r?\n/);
assert.equal(header, "language\tkey\ttext\theader");

/** The oracle's fingerprint: length and Java's String.hashCode of the trimmed text. */
function fingerprint(text: string | undefined): string {
	if (text === undefined || text === "") {
		return "-";
	}
	const trimmed = text.trim();
	let hash = 0;
	for (let i = 0; i < trimmed.length; i++) {
		hash = (Math.imul(31, hash) + trimmed.charCodeAt(i)) | 0;
	}
	return `${trimmed.length}:${(hash >>> 0).toString(16)}`;
}

test("service texts and headers agree with what the upstream reader finds in every language", async () => {
	assert.ok(lines.length > 1500, `the fixture holds only ${lines.length} rows`);
	const failures: string[] = [];
	for (const line of lines) {
		const [language, key, text, headerText] = line.split("\t") as [string, string, string, string];
		const prayer = await getPrayerText(language, key);
		const got = `${fingerprint(prayer?.text)}\t${fingerprint(prayer?.header)}`;
		if (got !== `${text}\t${headerText}`) {
			failures.push(`${language} ${key}: ${got} (upstream ${text}\t${headerText})`);
		}
	}
	assert.equal(failures.length, 0, `${failures.length} differences:\n${failures.slice(0, 12).join("\n")}`);
});
