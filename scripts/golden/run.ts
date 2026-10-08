// Compiles vendor/ponomar plus Golden.java and writes raw upstream dumps to scratch/golden/ (gitignored).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTEXT_VARIABLES, collectExpressions, makeContexts } from "./dsl-inputs.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const upstream = join(root, "vendor", "ponomar", "Ponomar");
const fullDir = join(root, "scratch", "golden");
const sampleDir = join(root, "tests", "fixtures", "golden");
mkdirSync(fullDir, { recursive: true });
mkdirSync(sampleDir, { recursive: true });

// Full dumps stay local; sampled fixtures are committed so tests need no JDK.
const SAMPLE_STRIDE = 101;

const DSL_CONTEXT_COUNT = 40;

const classes = mkdtempSync(join(tmpdir(), "ponomar-golden-"));
const runJava = (mode: string, output: string, stride: number): void => {
	execFileSync(
		"java",
		["-Djava.awt.headless=true", "-cp", classes, "Ponomar.Golden", mode, output, String(stride)],
		{ cwd: root, stdio: "inherit" },
	);
};

function runDsl(): void {
	const expressions = collectExpressions();
	const contexts = makeContexts(DSL_CONTEXT_COUNT);
	writeFileSync(join(fullDir, "dsl-expressions.txt"), expressions.join("\n") + "\n");
	writeFileSync(join(fullDir, "dsl-contexts.csv"), [CONTEXT_VARIABLES.join(","), ...contexts.map((c) => c.join(","))].join("\n") + "\n");
	runJava("dsl", join(fullDir, "dsl-results.csv"), 1);
	const results = readFileSync(join(fullDir, "dsl-results.csv"), "utf8").trim().split(/\r?\n/);
	writeFileSync(
		join(sampleDir, "dsl.json"),
		JSON.stringify({ variables: CONTEXT_VARIABLES, contexts, expressions, results }) + "\n",
	);
}

try {
	const sources = readdirSync(upstream)
		.filter((f) => f.endsWith(".java"))
		.map((f) => join(upstream, f));
	sources.push(join(root, "scripts", "golden", "Golden.java"));
	execFileSync("javac", ["-encoding", "UTF-8", "-nowarn", "-d", classes, ...sources], { stdio: "inherit" });

	const modes = process.argv.slice(2);
	for (const mode of modes.length > 0 ? modes : ["jdate", "pascha", "pcalendar", "dsl"]) {
		if (mode === "dsl") {
			runDsl();
		} else {
			for (const [dir, stride] of [[fullDir, 1], [sampleDir, SAMPLE_STRIDE]] as const) {
				runJava(mode, join(dir, `${mode}.csv`), stride);
			}
		}
		console.log(`wrote ${mode}`);
	}
} finally {
	rmSync(classes, { recursive: true, force: true });
}
