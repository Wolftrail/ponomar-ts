import { existsSync, readFileSync } from "node:fs";

export type GoldenRow = Record<string, string>;

const fixtureDir = new URL("../fixtures/golden/", import.meta.url);
const fullDir = new URL("../../scratch/golden/", import.meta.url);

function parse(text: string): GoldenRow[] {
	const [header, ...lines] = text.trim().split(/\r?\n/);
	const names = header!.split(",");
	return lines.map((line) => {
		const cells = line.split(",");
		return Object.fromEntries(names.map((name, i) => [name, cells[i]!]));
	});
}

export function loadGolden(name: string): GoldenRow[] {
	return parse(readFileSync(new URL(`${name}.csv`, fixtureDir), "utf8"));
}

/** The exhaustive local dump from `npm run golden`, or undefined when it has not been generated. */
export function loadFullGolden(name: string): GoldenRow[] | undefined {
	const url = new URL(`${name}.csv`, fullDir);
	return existsSync(url) ? parse(readFileSync(url, "utf8")) : undefined;
}
