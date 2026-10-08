// Inputs for the DSL oracle: every distinct Cmd/Tone/Value expression in the vendored data, plus fixed contexts.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const languagesDir = fileURLToPath(new URL("../../vendor/ponomar/Ponomar/languages/", import.meta.url));
const RULE_FILE = /[\\/]xml[\\/]Commands[\\/](DivineLiturgy|ServiceRules|Fasting|ScriptureTransfers)\.xml$/;

/** Distinct expressions, whitespace collapsed to single spaces so both sides see identical text. */
export function collectExpressions(): string[] {
	const found = new Set<string>();
	const walk = (dir: string): void => {
		for (const name of readdirSync(dir)) {
			const path = join(dir, name);
			if (statSync(path).isDirectory()) {
				walk(path);
			} else if (name.endsWith(".xml")) {
				const text = readFileSync(path, "utf8");
				for (const match of text.matchAll(/\b(Cmd|Value|Tone)\s*=\s*"([^"]*)"/g)) {
					if (match[1] === "Value" && !RULE_FILE.test(path)) {
						continue;
					}
					const value = match[2]!
						.replaceAll("&amp;", "&")
						.replaceAll("&lt;", "<")
						.replaceAll("&gt;", ">")
						.replaceAll("&quot;", '"')
						.replace(/\s+/g, " ")
						.trim();
					if (value !== "") {
						found.add(value);
					}
				}
			}
		}
	};
	walk(languagesDir);
	return [...found].sort();
}

export const CONTEXT_VARIABLES = [
	"nday",
	"ndayP",
	"ndayF",
	"doy",
	"dow",
	"dRank",
	"GS",
	"PS",
	"PFlag",
	"PFlag1",
	"PFlag2",
	"PFlag3",
	"Times",
	"Year",
] as const;

/** Deterministic contexts; `dow` cycles through all weekdays and the rest come from a fixed LCG. */
export function makeContexts(count: number): number[][] {
	let state = 12345;
	const next = (low: number, high: number): number => {
		state = (state * 1103515245 + 12345) % 2147483648;
		return low + (state % (high - low + 1));
	};
	return Array.from({ length: count }, (_, i) => [
		next(-120, 320),
		next(0, 400),
		next(-400, 0),
		next(0, 366),
		i % 7,
		next(0, 8),
		next(0, 1),
		next(0, 2),
		next(0, 3),
		next(0, 3),
		next(0, 3),
		next(0, 3),
		next(1, 4),
		next(1900, 2100),
	]);
}
