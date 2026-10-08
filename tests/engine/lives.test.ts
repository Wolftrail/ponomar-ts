import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
	commemorationHymns,
	commemorationLife,
	commemorationNames,
	type CommemorationHymn,
	type NameForm,
	nameForm,
} from "../../src/engine/commemoration.ts";
import { dayVariables } from "../../src/engine/context.ts";

const FORMS: readonly NameForm[] = ["nominative", "genitive", "dative", "possessive", "short", "shortF", "name", "index"];

type Row = Record<string, string>;

function load(path: URL): Row[] {
	const [header, ...lines] = readFileSync(path, "utf8").replace(/\r?\n$/, "").split(/\r?\n/);
	const names = header!.split("\t");
	return lines.map((line) => Object.fromEntries(line.split("\t").map((cell, i) => [names[i]!, cell])));
}

const clean = (text: string): string => text.replace(/[\t\r\n]/g, " ");

/** The oracle's fingerprint: length and Java's String.hashCode of the trimmed text. */
function fingerprint(text: string): string {
	const trimmed = text.trim();
	let hash = 0;
	for (let i = 0; i < trimmed.length; i++) {
		hash = (Math.imul(31, hash) + trimmed.charCodeAt(i)) | 0;
	}
	return `${trimmed.length}:${(hash >>> 0).toString(16)}`;
}

const hasMarkup = (text: string): boolean => text.includes("<br/>") || text.includes("<p>");

/** Upstream keeps only the last text chunk of an element, so texts with inline markup are not comparable. */
function hymnCell(hymn: CommemorationHymn | undefined): string | undefined {
	if (hymn === undefined) {
		return "-";
	}
	return hasMarkup(hymn.text) ? undefined : `${hymn.tone ?? ""}/${hymn.podoben ?? ""}/${fingerprint(hymn.text)}`;
}

async function compare(rows: readonly Row[]): Promise<string[]> {
	const failures: string[] = [];
	for (const row of rows) {
		const language = row["language"]!;
		const cid = row["cid"]!;
		const context = dayVariables({ year: Number(row["year"]), month: Number(row["month"]), day: Number(row["day"]) }, 0);
		const where = `${language} ${cid} ${row["year"]}-${row["month"]}-${row["day"]}`;
		const check = (what: string, got: string | undefined, expected: string | undefined): void => {
			if (got !== undefined && got !== expected) {
				failures.push(`${where} ${what}: ${got} (upstream ${expected})`);
			}
		};

		const names = await commemorationNames(cid, language, context);
		for (const form of FORMS) {
			const value = nameForm(names, form);
			check(form, value === undefined ? "-" : clean(value), row[form]);
		}

		const life = await commemorationLife(cid, language);
		check("life", life === undefined ? "-" : hasMarkup(life.text) ? undefined : fingerprint(life.text), row["life"]);
		check("copyright", life?.copyright === undefined ? "-" : clean(life.copyright), row["copyright"]);
		check("lifeId", life?.id === undefined ? "-" : clean(life.id), row["lifeId"]);

		for (const [column, kind, type] of [
			["troparion1", "troparion", "1"],
			["troparion2", "troparion", "2"],
			["kontakion1", "kontakion", "1"],
			["kontakion2", "kontakion", "2"],
		] as const) {
			const hymns = await commemorationHymns(cid, language, "liturgy", kind, context);
			check(column, hymnCell(hymns[type]), row[column]);
		}
	}
	return failures;
}

const sample = load(new URL("../fixtures/golden/lives.tsv", import.meta.url));
const fullPath = new URL("../../scratch/golden/lives.tsv", import.meta.url);

test("commemoration names, lives and hymns agree with the upstream engine", async () => {
	assert.ok(sample.length > 1000, `the fixture holds only ${sample.length} rows`);
	const failures = await compare(sample);
	assert.equal(failures.length, 0, `${failures.length} differences in ${sample.length} rows:\n${failures.slice(0, 15).join("\n")}`);
});

test("commemoration data agrees with the upstream engine on the full dump", { skip: !existsSync(fullPath) }, async () => {
	// Upstream throws partway through this file (a name in a numeric Type) and drops the rest; the port reads it whole.
	const rows = load(fullPath).filter((row) => !(row["language"] === "el/mono/" && row["cid"] === "08160600"));
	const failures = await compare(rows);
	assert.equal(failures.length, 0, `${failures.length} differences in ${rows.length} rows:\n${failures.slice(0, 15).join("\n")}`);
});
