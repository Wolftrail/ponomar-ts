// Regenerates src/data/generated from the vendored Ponomar XML. `--check` fails if the output has drifted.
import { generateAll } from "./all.ts";
import { findDrift, writeFiles } from "./emit.ts";

const files = generateAll();

if (process.argv.includes("--check")) {
	const drift = findDrift(files);
	if (drift.length > 0) {
		console.error(`generated data is out of date (${drift.length} files):\n${drift.map((p) => `  ${p}`).join("\n")}`);
		process.exit(1);
	}
	console.log(`generated data is up to date (${files.length} files)`);
} else {
	writeFiles(files);
	console.log(`wrote ${files.length} files`);
}
