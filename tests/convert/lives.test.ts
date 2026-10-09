import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { LANGUAGES, languageSlug, listFiles, xmlDir } from "../../scripts/convert/sources.ts";
import { LIFE_CHUNKS } from "../../src/data/generated/lives/index.ts";
import type { Life } from "../../src/data/types.ts";

const livesDir = fileURLToPath(new URL("../../src/data/generated/lives/", import.meta.url));
type Chunk = Readonly<Record<string, Life>>;

async function loadChunk(chunk: string, language: string): Promise<Chunk | undefined> {
	const file = `${chunk}.${languageSlug(language)}.ts`;
	if (!readdirSync(livesDir).includes(file)) {
		return undefined;
	}
	return ((await import(`../../src/data/generated/lives/${file}`)) as { LIVES: Chunk }).LIVES;
}

const chunkNames: string[] = [...new Set<string>(Object.values(LIFE_CHUNKS))].sort();

function rawCounts(language: string): Record<string, number> {
	const totals: Record<string, number> = { files: 0, NAME: 0, LIFE: 0, SERVICE: 0, SCRIPTURE: 0, hymns: 0, verses: 0, INFO: 0, REF: 0 };
	for (const file of listFiles(language, "lives")) {
		const text = readFileSync(join(xmlDir(language), "lives", file), "utf8").replace(/<!--[\s\S]*?-->/g, "");
		const count = (names: string): number => (text.match(new RegExp(`<(${names})[\\s/>]`, "g")) ?? []).length;
		totals["files"]! += 1;
		totals["NAME"]! += count("NAME");
		totals["LIFE"]! += count("LIFE");
		totals["SERVICE"]! += count("SERVICE");
		totals["SCRIPTURE"]! += count("SCRIPTURE");
		totals["hymns"]! += count("TROPARION|KONTAKION");
		totals["verses"]! += count("IDIOMEL|PROKEIMENON|VERSE|STICHOS");
		totals["INFO"]! += count("INFO");
		totals["REF"]! += count("REF");
	}
	return totals;
}

function convertedCounts(lives: Chunk[]): Record<string, number> {
	const totals: Record<string, number> = { files: 0, NAME: 0, LIFE: 0, SERVICE: 0, SCRIPTURE: 0, hymns: 0, verses: 0, INFO: 0, REF: 0 };
	for (const chunk of lives) {
		for (const life of Object.values(chunk)) {
			totals["files"]! += 1;
			totals["NAME"]! += life.names.length;
			totals["LIFE"]! += life.biographies.length;
			totals["SERVICE"]! += life.services.length;
			totals["INFO"]! += life.info.length;
			totals["REF"]! += life.refs.length + life.names.filter((n) => n.refCid !== undefined).length;
			totals["hymns"]! += life.hymns.length;
			for (const service of life.services) {
				totals["hymns"]! += service.hymns.length;
				for (const section of service.sections) {
					for (const item of section.items) {
						if (item.kind === "scripture") {
							totals["SCRIPTURE"]! += 1;
						} else if (item.kind === "troparion" || item.kind === "kontakion") {
							totals["hymns"]! += 1;
						} else {
							totals["verses"]! += 1;
						}
					}
				}
			}
		}
	}
	return totals;
}

test("every language's lives are fully converted, checked against raw XML counts", async () => {
	for (const language of LANGUAGES) {
		const chunks: Chunk[] = [];
		for (const chunk of chunkNames) {
			const loaded = await loadChunk(chunk, language);
			if (loaded !== undefined) {
				chunks.push(loaded);
			}
		}
		assert.deepEqual(convertedCounts(chunks), rawCounts(language), `language "${language}"`);
	}
});

test("each life sits in the chunk its id is indexed under, and chunks are month-sized", async () => {
	for (const language of ["", "en", "cu/ru"]) {
		for (const chunk of chunkNames) {
			const loaded = await loadChunk(chunk, language);
			for (const cid of Object.keys(loaded ?? {})) {
				assert.equal(LIFE_CHUNKS[cid], chunk, `${language}/${cid}`);
			}
		}
	}
	assert.deepEqual(chunkNames, ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "movable", "other"]);
	for (const file of readdirSync(livesDir)) {
		assert.ok(readFileSync(join(livesDir, file)).length < 2 * 1024 * 1024, `${file} is over 2 MB`);
	}
});

test("index covers every life id in every language", () => {
	const ids = new Set<string>();
	for (const language of LANGUAGES) {
		for (const file of listFiles(language, "lives")) {
			ids.add(file.replace(/\.xml$/, ""));
		}
	}
	assert.equal(Object.keys(LIFE_CHUNKS).length, ids.size);
	assert.equal(LIFE_CHUNKS["010101"], "01");
	assert.equal(LIFE_CHUNKS["01050099"], "other");
});

test("life values keep ranks, readings, hymns and text", async () => {
	const base = (await loadChunk("01", ""))!["010101"]!;
	assert.equal(base.services[0]!.type, "8");
	assert.deepEqual(base.services[0]!.sections[0], {
		section: "vespers",
		items: [
			{ kind: "scripture", type: "1", reading: "Gen_17:1-7, 9-12, 14" },
			{ kind: "scripture", type: "2", reading: "Prov_8:22-30" },
			{ kind: "scripture", type: "3", reading: "Prov_10:31-32, 11:1-12" },
		],
	});
	assert.deepEqual(base.services[0]!.sections[1]!.items[1], { kind: "scripture", type: "gospel", pericope: "6", reading: "Lk_2:20-21, 40-52" });

	const en = (await loadChunk("01", "en"))!["010101"]!;
	assert.deepEqual(en.names, [{ nominative: "Circumcision of our Lord", short: "Circumcision" }]);
	assert.equal(en.biographies[0]!.id, "bulgakov");
	assert.match(en.biographies[0]!.text, /^The Circumcision \(Обрезание\/Obrezanie\) of the Lord/);
	const troparion = en.services[0]!.sections[0]!.items[0]!;
	assert.equal(troparion.kind, "troparion");
	assert.match((troparion as { text: string }).text, /^O Jesus, Who in the highest dost sit/);
});

test("inline markup in biographies is kept as HTML", async () => {
	// Only el/mono biographies contain <br/>.
	let found = false;
	for (const chunk of chunkNames) {
		for (const life of Object.values((await loadChunk(chunk, "el/mono")) ?? {})) {
			found ||= life.biographies.some((b) => b.text.includes("<br/>"));
		}
	}
	assert.ok(found, "expected at least one el/mono biography with <br/>");
});
