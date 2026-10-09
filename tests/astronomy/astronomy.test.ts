import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatClockTime, getSunriseSunset, getSunriseSunsetStrings, lunarAge, lunarPhase, type SunPlace } from "../../src/astronomy/astronomy.ts";
import { julianDate } from "../../src/core/calendar/jdate.ts";

function load(name: string): Record<string, string>[] {
	const [header, ...lines] = readFileSync(new URL(`../fixtures/golden/${name}.tsv`, import.meta.url), "utf8").replace(/\r?\n$/, "").split(/\r?\n/);
	const names = header!.split("\t");
	return lines.map((line) => Object.fromEntries(line.split("\t").map((cell, i) => [names[i]!, cell])));
}

// The places the oracle uses (Golden.PLACES).
const PLACES: Readonly<Record<string, SunPlace>> = {
	default: { longitude: 45, latitude: 51, timeZone: 1 },
	moscow: { longitude: 37.62, latitude: 55.75, timeZone: 3 },
	jordanville: { longitude: -74.99, latitude: 42.93, timeZone: -5 },
	sydney: { longitude: 151.2, latitude: -33.87, timeZone: 10 },
	equator: { longitude: 0, latitude: 0, timeZone: 0 },
	reykjavik: { longitude: -21.9, latitude: 64.15, timeZone: 0 },
	tromso: { longitude: 18.96, latitude: 69.65, timeZone: 1 },
	mcmurdo: { longitude: 166.67, latitude: -77.85, timeZone: 12 },
};

const jdnOf = (row: Record<string, string>): number => julianDate(Number(row["year"]), Number(row["month"]), Number(row["day"])).jdn;

// The trigonometric functions of Java and V8 may differ in the last bit, which stays far below a millisecond of time.
const close = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

test("sunrise and sunset agree with the upstream engine", () => {
	const rows = load("sun");
	assert.ok(rows.length > 4000, `the fixture holds only ${rows.length} rows`);
	const failures: string[] = [];
	for (const row of rows) {
		const times = getSunriseSunset(jdnOf(row), PLACES[row["place"]!]!, { dst: row["dst"] === "1", altitude: Number(row["altitude"]) });
		if (!close(times.sunrise, Number(row["sunrise"])) || !close(times.sunset, Number(row["sunset"]))) {
			failures.push(`${row["year"]}-${row["month"]}-${row["day"]} ${row["place"]}: ${times.sunrise} ${times.sunset} (upstream ${row["sunrise"]} ${row["sunset"]})`);
		}
	}
	assert.equal(failures.length, 0, `${failures.length} differences:\n${failures.slice(0, 10).join("\n")}`);
});

test("sunrise and sunset are written as each language asks", async () => {
	const rows = load("suntime");
	assert.ok(rows.length > 3000, `the fixture holds only ${rows.length} rows`);
	const failures: string[] = [];
	for (const row of rows) {
		const got = await getSunriseSunsetStrings(row["language"]!, jdnOf(row), PLACES[row["place"]!]!, { ideographic: row["ideographic"] === "1" });
		if (got.sunrise !== row["sunrise"] || got.sunset !== row["sunset"]) {
			failures.push(`${row["language"]} ${row["ideographic"]} ${row["year"]}-${row["month"]}-${row["day"]} ${row["place"]}: ${got.sunrise} | ${got.sunset} (upstream ${row["sunrise"]} | ${row["sunset"]})`);
		}
	}
	assert.equal(failures.length, 0, `${failures.length} differences:\n${failures.slice(0, 10).join("\n")}`);
});

test("the moon's age and phase agree with the upstream engine", async () => {
	const rows = load("moon");
	assert.ok(rows.length > 800, `the fixture holds only ${rows.length} rows`);
	const failures: string[] = [];
	for (const row of rows) {
		const jdn = Number(row["jdn"]);
		assert.equal(jdnOf(row), jdn);
		if (!close(lunarAge(jdn), Number(row["age"]))) {
			failures.push(`${jdn}: age ${lunarAge(jdn)} (upstream ${row["age"]})`);
		}
		for (const language of ["en/", "cu/ru/", "fr/", "zh/Hans/"]) {
			const phase = await lunarPhase(language, jdn);
			if (phase !== row[language]) {
				failures.push(`${jdn} ${language}: ${phase} (upstream ${row[language]})`);
			}
		}
	}
	assert.equal(failures.length, 0, `${failures.length} differences:\n${failures.slice(0, 10).join("\n")}`);
});

test("a time is padded as the language's phrases say", async () => {
	assert.equal(await formatClockTime("en", 5.5), "5:30");
	assert.equal(await formatClockTime("cu/ru", 5.5), "05:30");
	assert.equal(await formatClockTime("fr", 17.25), "17 h 15 min");
});
