// Codegen entry point. Walks vendor/ponomar/ upstream data and emits typed
// TypeScript modules under src/data/. Individual parsers plug in here as the
// port progresses (see PLAN.md, Phase 3).
//
// Usage:
//   npm run codegen           # regenerate all data modules
//   npm run codegen -- --check  # exit non-zero if any generated file drifts

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const vendorRoot = resolve(repoRoot, "vendor", "ponomar");
const dataRoot = resolve(repoRoot, "src", "data");

const checkOnly = process.argv.includes("--check");

if (!existsSync(vendorRoot)) {
	process.stderr.write(
		`vendor/ponomar/ is missing. Run: git submodule update --init --recursive\n`,
	);
	process.exit(1);
}

interface Parser {
	readonly name: string;
	run(ctx: CodegenContext): Promise<void>;
}

export interface CodegenContext {
	readonly vendorRoot: string;
	readonly dataRoot: string;
	readonly checkOnly: boolean;
}

const parsers: readonly Parser[] = [
	// Populated by Phase 3. Each parser lives in its own file:
	//   parse-commands-xml.ts   -> src/data/commands/*.ts
	//   parse-day-xml.ts        -> src/data/calendar/{triodion,pentecostarion}.ts
	//   parse-menaion-xml.ts    -> src/data/calendar/menaion.ts
	//   parse-services-xml.ts   -> src/data/services/*.ts
	//   parse-bible-index.ts    -> src/data/bible/index.ts
];

const ctx: CodegenContext = { vendorRoot, dataRoot, checkOnly };

if (parsers.length === 0) {
	process.stdout.write(
		"codegen: no parsers registered yet (Phase 3 pending).\n",
	);
	process.stdout.write(`  vendor: ${vendorRoot}\n`);
	process.stdout.write(`  output: ${dataRoot}\n`);
	process.exit(0);
}

for (const parser of parsers) {
	process.stdout.write(`codegen: ${parser.name}\n`);
	await parser.run(ctx);
}
