import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { FASTING, DIVINE_LITURGY_COMMANDS, SCRIPTURE_TRANSFER_COMMANDS, SERVICE_RULES } from "../../src/data/generated/rules.ts";
import { MENAION as MENAION_BASE } from "../../src/data/generated/days/menaion.base.ts";
import { MENAION as MENAION_CU } from "../../src/data/generated/days/menaion.cu.ts";
import { MENAION as MENAION_EN } from "../../src/data/generated/days/menaion.en.ts";
import { PENTECOSTARION } from "../../src/data/generated/days/pentecostarion.base.ts";
import { TRIODION } from "../../src/data/generated/days/triodion.base.ts";
import { FLOAT as FLOAT_EN } from "../../src/data/generated/days/float.en.ts";
import { generateAll } from "../../scripts/convert/all.ts";
import { findDrift } from "../../scripts/convert/emit.ts";
import { LANGUAGES, languageChain, languageSlug, listFiles, xmlDir } from "../../scripts/convert/sources.ts";
import { DEFAULT_CONFIGURATION } from "../../src/data/generated/config.ts";
import { LANGUAGE_PACK as PACK_CU } from "../../src/data/generated/language/cu.ts";
import { LANGUAGE_PACK as PACK_CU_RU } from "../../src/data/generated/language/cu-ru.ts";
import { LANGUAGE_PACK as PACK_EN } from "../../src/data/generated/language/en.ts";
import { LANGUAGE_PACK as PACK_FR } from "../../src/data/generated/language/fr.ts";

/** Counts `<name` occurrences outside comments, without using the project's XML parser. */
function count(path: string, element: string): number {
	const text = readFileSync(path, "utf8").replace(/<!--[\s\S]*?-->/g, "");
	return (text.match(new RegExp(`<${element}[\\s/>]`, "g")) ?? []).length;
}

test("language chain follows upstream langFileFind", () => {
	assert.deepEqual(languageChain("cu/ru"), ["cu/ru", "cu", ""]);
	assert.deepEqual(languageChain("cu/ru/"), ["cu/ru", "cu", ""]);
	assert.deepEqual(languageChain("el/mono"), ["el/mono", "el", ""]);
	assert.deepEqual(languageChain("zh/Hans"), ["zh/Hans", "zh", ""]);
	assert.deepEqual(languageChain("en"), ["en", ""]);
	assert.deepEqual(languageChain(""), [""]);
	assert.equal(languageSlug("cu/ru"), "cu-ru");
	assert.equal(languageSlug(""), "base");
	assert.ok(LANGUAGES.every((language) => languageChain(language).at(-1) === ""));
});

test("generated data is up to date", () => {
	assert.deepEqual(findDrift(generateAll()), []);
});

test("rule files keep every period, rule and command", () => {
	const commands = join(xmlDir(""), "Commands");
	assert.equal(FASTING.length, count(join(commands, "Fasting.xml"), "PERIOD"));
	assert.equal(FASTING.reduce((n, p) => n + p.rules.length, 0), count(join(commands, "Fasting.xml"), "RULE"));
	assert.equal(SERVICE_RULES.length, count(join(commands, "ServiceRules.xml"), "PERIOD"));
	const hours = ["PRIME", "TERCE", "SEXTE", "NONE"].reduce((n, h) => n + count(join(commands, "ServiceRules.xml"), h), 0);
	assert.equal(SERVICE_RULES.reduce((n, p) => n + p.entries.length, 0), hours);
	assert.equal(DIVINE_LITURGY_COMMANDS.length, count(join(commands, "DivineLiturgy.xml"), "COMMAND"));
	assert.equal(SCRIPTURE_TRANSFER_COMMANDS.length, count(join(commands, "ScriptureTransfers.xml"), "COMMAND"));
});

test("rule files decode escaped expressions and keep file order", () => {
	assert.deepEqual(FASTING[0]!.rules[0], { level: "0000111", cmd: "dow == 0 || dow == 6" });
	assert.equal(FASTING[0]!.cmd, "nday >= -48 && nday <= -9");
	assert.equal(FASTING.at(-1)!.cmd, undefined);
	assert.equal(SERVICE_RULES[0]!.entries[0]!.hour, "prime");
	assert.equal(DIVINE_LITURGY_COMMANDS[0]!.name, "Transfer");
	assert.equal(DIVINE_LITURGY_COMMANDS[0]!.cmd, "GS == 1");
	assert.match(DIVINE_LITURGY_COMMANDS[0]!.comment!, /sequential readings/);
});

test("day files keep every commemoration", () => {
	const samples: [string, Record<string, readonly unknown[]>, string][] = [
		["", MENAION_BASE, "xml"],
		["cu", MENAION_CU, "cu/xml"],
		["en", MENAION_EN, "en/xml"],
	];
	for (const [language, days, label] of samples) {
		for (const [key, saints] of Object.entries(days)) {
			const [month, day] = key.split("-");
			const path = join(xmlDir(language), month!, `${day}.xml`);
			assert.equal(saints.length, count(path, "SAINT"), `${label}/${key}`);
		}
	}
	for (const [key, saints] of Object.entries(TRIODION)) {
		assert.equal(saints.length, count(join(xmlDir(""), "triodion", `${String(key).padStart(2, "0")}.xml`), "SAINT"), `triodion ${key}`);
	}
	for (const [key, saints] of Object.entries(PENTECOSTARION)) {
		assert.equal(saints.length, count(join(xmlDir(""), "pentecostarion", `${String(key).padStart(2, "0")}.xml`), "SAINT"), `pentecostarion ${key}`);
	}
});

test("day file coverage and values", () => {
	assert.equal(Object.keys(TRIODION).length, 70);
	assert.equal(Object.keys(PENTECOSTARION).length, 315);
	assert.equal(Object.keys(MENAION_EN).length, 366);
	assert.equal(Object.keys(MENAION_CU).length, 366); // 367 files; 01/14_new.xml is a leftover draft
	assert.deepEqual(Object.keys(MENAION_BASE).sort(), ["01-01", "01-02", "01-30", "12-30", "12-31"]);
	assert.deepEqual(TRIODION[1], [{ sid: ["0"], cid: "9801", tone: "-1" }]);
	assert.deepEqual(MENAION_EN["01-01"]![2], { sid: ["772428", "772429", "772430"], cid: "010102" });
	assert.deepEqual(PENTECOSTARION[255]![0], { sid: [], cid: "9902", cmd: "doy == 0" });
	assert.equal(MENAION_CU["01-14"]!.length, 7);
});

test("float files carry readings and names", () => {
	assert.deepEqual(FLOAT_EN[9]!.scriptures[0], { type: "apostol", reading: "I Thess_4:13-17", note: "for the departed", pericope: "270" });
	assert.equal(FLOAT_EN[9]!.saints[0]!.id, "");
});

test("language packs keep every phrase and only the files a language defines", () => {
	const unique = (language: string, file: string): number => {
		const text = readFileSync(join(xmlDir(language), "Commands", file), "utf8").replace(/<!--[\s\S]*?-->/g, "");
		return new Set([...text.matchAll(/<PHRASE\s+Key\s*=\s*"([^"]*)"/g)].map((m) => m[1])).size;
	};
	assert.equal(Object.keys(PACK_EN.phrases!).length, unique("en", "LanguagePacks.xml"));
	assert.equal(Object.keys(PACK_CU.phrases!).length, unique("cu", "LanguagePacks.xml"));
	assert.equal(Object.keys(PACK_FR.numberRules!).length, unique("fr", "RuleBasedNumbers.xml"));
	assert.equal(PACK_EN.podobni!.length, count(join(xmlDir("en"), "Commands", "Podobni.xml"), "PODOBEN"));
	// cu/ru only defines LanguagePacks.xml, so Times, Podobni and RuleBasedNumbers fall back to cu.
	assert.deepEqual(listFiles("cu/ru", "Commands"), ["LanguagePacks.xml"]);
	assert.equal(PACK_CU_RU.times, undefined);
	assert.equal(PACK_CU_RU.podobni, undefined);
	assert.equal(PACK_CU_RU.numberRules, undefined);
	assert.ok(PACK_CU.times!.length >= 7);
});

test("language pack values keep markup and per-language wording", () => {
	assert.equal(PACK_EN.phrases!["Colon"], ": ");
	assert.equal(PACK_FR.phrases!["Colon"], " : ");
	assert.deepEqual(PACK_EN.times![0], { value: "<i>Twice</i>", cmd: "Times == 2" });
	assert.deepEqual(PACK_EN.podobni![0], {
		tone: "2",
		case: "1",
		intro: "With what wreaths of praise",
		comment: "At Vespers, on Lord, I have cried for Sts Peter and Paul.",
	});
});

test("default configuration keeps its attributes", () => {
	assert.equal(DEFAULT_CONFIGURATION["Language"], "en/");
	assert.equal(DEFAULT_CONFIGURATION["GospelSelector"], "TheophanyJump");
});
