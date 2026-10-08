import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { findDrift } from "../../scripts/convert/emit.ts";
import { convertServices } from "../../scripts/convert/families/services.ts";
import { LANGUAGES, languageSlug, listFiles, xmlDir } from "../../scripts/convert/sources.ts";
import { PRAYERS as PRAYERS_EN } from "../../src/data/generated/services/prayers.en.ts";
import { SERVICE_TEMPLATES } from "../../src/data/generated/services/templates.ts";
import type { OctoechosEntry, PrayerText, ServiceDirective } from "../../src/data/types.ts";

const servicesDir = join(import.meta.dirname, "../../src/data/generated/services");

/** Counts `<name` occurrences outside comments without the project's XML parser. */
function count(path: string, names: string): number {
	const text = readFileSync(path, "utf8").replace(/<!--[\s\S]*?-->/g, "");
	return (text.match(new RegExp(`<(${names})[\\s/>]`, "g")) ?? []).length;
}

const DIRECTIVES: Record<ServiceDirective["directive"], string> = {
	title: "TITLE",
	subtitle: "SUBTITLE",
	get: "GET",
	create: "CREATE",
	bible: "BIBLE",
	getId: "GETID",
};

test("every service template is converted with all of its directives", () => {
	const files = listFiles("", "Services");
	assert.equal(files.length, 28);
	assert.deepEqual(Object.keys(SERVICE_TEMPLATES).sort(), files.map((f) => f.replace(/\.xml$/, "")).sort());
	for (const file of files) {
		const directives = SERVICE_TEMPLATES[file.replace(/\.xml$/, "")]!;
		const path = join(xmlDir(""), "Services", file);
		for (const [kind, element] of Object.entries(DIRECTIVES)) {
			assert.equal(directives.filter((d) => d.directive === kind).length, count(path, element), `${file} ${element}`);
		}
	}
});

test("template directives keep their attributes and order", () => {
	const prime = SERVICE_TEMPLATES["Prime"]!;
	assert.deepEqual(prime[0], { directive: "title", value: "PrimesV", header: "Primes1", source: "PrimeSource", comment: "PrimeComment" });
	assert.deepEqual(prime[1], { directive: "get", file: "UsualBeginning", cmd: "PFlag1 == 0 || PFlag1 == 2" });
	assert.deepEqual(prime[2], { directive: "create", what: "ComeWorship1", who: "R", redFirst: "1", newLine: "1", command: "Bow" });
	const kathisma = SERVICE_TEMPLATES["Kathisma1"]!;
	assert.deepEqual(kathisma[0], { directive: "bible", verses: "Psalm_1", who: "", redFirst: "1", newLine: "1", header: "1", twoStars: "1" });
});

test("prayer texts keep every file of every language", async () => {
	const directories = ["CommonPrayers", "CommonPrayers/KONTAKION", "CommonPrayers/TROPARION", "Command", "Header", "Text"];
	for (const language of LANGUAGES) {
		const expected = directories.reduce((n, dir) => n + listFiles(language, `Services/${dir}`).length, 0);
		const module = join(servicesDir, `prayers.${languageSlug(language)}.ts`);
		if (expected === 0) {
			assert.ok(!existsSync(module), `${language} should have no prayers module`);
			continue;
		}
		const table = ((await import(pathToFileURL(module).href)) as { PRAYERS: Record<string, PrayerText> }).PRAYERS;
		assert.equal(Object.keys(table).length, expected, `language "${language}"`);
	}
});

test("prayer text and header values are exact", () => {
	const creed = PRAYERS_EN["CommonPrayers/NiceneCreed"]!;
	assert.equal(creed.header, "Nicene Creed");
	assert.match(creed.text, /^I believe in one God, the Father Almighty/);
	assert.ok(!creed.text.includes("\n"), "attribute newlines are normalized to spaces, as XML and upstream do");
	assert.ok(creed.text.includes("of heaven and earth, and of all things visible and invisible."));
	assert.deepEqual(PRAYERS_EN["Command/AfterEach"], { text: ", after each" });
	const troparia = Object.keys(PRAYERS_EN).filter((key) => key.startsWith("CommonPrayers/TROPARION/"));
	assert.ok(troparia.length >= 50, `expected the troparion texts, found ${troparia.length}`);
});

test("octoechos tables keep every hour entry of every tone and weekday", async () => {
	for (const language of LANGUAGES) {
		let files = 0;
		let hours = 0;
		for (let tone = 0; tone <= 7; tone++) {
			for (const file of listFiles(language, `Services/Octoecheos/Tone ${tone}`)) {
				files++;
				hours += count(join(xmlDir(language), "Services", "Octoecheos", `Tone ${tone}`, file), "PRIMES|TERCE|SEXTE|NONE");
			}
		}
		const module = join(servicesDir, `octoechos.${languageSlug(language)}.ts`);
		if (files === 0) {
			assert.ok(!existsSync(module), `${language} should have no octoechos module`);
			continue;
		}
		const table = ((await import(pathToFileURL(module).href)) as { OCTOECHOS: Record<string, OctoechosEntry[]> }).OCTOECHOS;
		assert.equal(Object.keys(table).length, files, `${language} files`);
		assert.equal(Object.values(table).reduce((n, entries) => n + entries.length, 0), hours, `${language} entries`);
	}
	const en = ((await import(pathToFileURL(join(servicesDir, "octoechos.en.ts")).href)) as { OCTOECHOS: Record<string, OctoechosEntry[]> }).OCTOECHOS;
	assert.deepEqual(en["1/Monday"]![0], { hour: "primes", type: "Normal", troparion1: "MON1", kontakion1: "MON1", cmd: "!(nday > -50 && nday < 0)" });
});

test("scratch and unused families are not converted", () => {
	const generated = convertServices().map((f) => f.path);
	assert.ok(generated.every((p) => !/Var|Commemorations/i.test(p)));
});

test("generated services data is up to date", () => {
	assert.deepEqual(findDrift(convertServices()), []);
});
