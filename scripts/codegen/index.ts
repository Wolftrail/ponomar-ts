// Codegen entry point. Walks vendor/ponomar/ upstream data and emits typed
// TypeScript modules under src/data/.
//
// Usage:
//   npm run codegen                  # regenerate all data modules
//   npm run codegen -- --check       # non-zero exit if any generated file drifts

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	emitCommands,
	emitCommemorations,
	emitCycle,
	emitFasting,
	emitLives,
	emitMenaion,
	emitPhrases,
	emitServiceRules,
	emitServiceTemplates,
	type EmittedFile,
} from "./emit.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const vendorRoot = resolve(
	repoRoot,
	"vendor",
	"ponomar",
	"Ponomar",
	"languages",
);
const vendorXml = resolve(vendorRoot, "xml");
const vendorCuXml = resolve(vendorRoot, "cu", "xml");
const vendorEnXml = resolve(vendorRoot, "en", "xml");
const dataRoot = resolve(repoRoot, "src", "data");
const checkOnly = process.argv.includes("--check");

if (!existsSync(vendorXml)) {
	process.stderr.write(
		"vendor/ponomar/Ponomar/languages/xml is missing. Run: git submodule update --init --recursive\n",
	);
	process.exit(1);
}

const emitted: EmittedFile[] = [
	emitCycle("PENTECOSTARION", path.join(vendorXml, "pentecostarion")),
	emitCycle("TRIODION", path.join(vendorXml, "triodion")),
	emitMenaion(vendorXml, vendorCuXml),
	emitCommands(
		"DIVINE_LITURGY_COMMANDS",
		path.join(vendorXml, "Commands", "DivineLiturgy.xml"),
		"divineLiturgy.ts",
	),
	emitFasting(path.join(vendorXml, "Commands", "Fasting.xml")),
	emitServiceRules(path.join(vendorXml, "Commands", "ServiceRules.xml")),
	emitServiceTemplates(path.join(vendorXml, "Services")),
	emitPhrases(path.join(vendorEnXml, "Services")),
	emitCommemorations([
		path.join(vendorXml, "lives"),
		path.join(vendorXml, "Commemorations"),
		path.join(vendorEnXml, "lives"),
	]),
	emitLives([
		path.join(vendorXml, "lives"),
		path.join(vendorXml, "Commemorations"),
		path.join(vendorEnXml, "lives"),
	]),
];

mkdirSync(dataRoot, { recursive: true });

let drifted = false;
for (const f of emitted) {
	const target = path.join(dataRoot, f.relPath);
	if (checkOnly) {
		const current = existsSync(target) ? readFileSync(target, "utf8") : "";
		if (current !== f.content) {
			process.stderr.write(`codegen: DRIFT ${f.relPath}\n`);
			drifted = true;
		}
	} else {
		writeFileSync(target, f.content);
		process.stdout.write(`codegen: wrote ${f.relPath}\n`);
	}
}

if (checkOnly && drifted) process.exit(1);
if (checkOnly) process.stdout.write("codegen: all generated files up to date\n");
