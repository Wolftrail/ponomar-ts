// Compiles vendor/ponomar plus Golden.java and writes raw upstream dumps to scratch/golden/ (gitignored).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTEXT_VARIABLES, collectExpressions, makeContexts } from "./dsl-inputs.ts";
import { PRAYER_LOADERS } from "../../src/data/generated/registry.ts";

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

// Years chosen to move the Triodion and Lucan Jump boundaries: earliest and latest Pascha, leap and non-leap, and now.
const DAY_YEARS = "2010,2024,2026,2037,2041,2048,2078";
const DAY_SAMPLE_EVERY = 5;

function runDay(): void {
	const full = join(fullDir, "day.tsv");
	runInVendor("day", full, "1", DAY_YEARS);
	const lines = readFileSync(full, "utf8").trim().split(/\r?\n/);
	const sample = [lines[0]!, ...lines.slice(1).filter((_, i) => i % DAY_SAMPLE_EVERY === 0)];
	writeFileSync(join(sampleDir, "day.tsv"), sample.join("\n") + "\n");
}

// The upstream engine reads its data relative to vendor/ponomar; stderr carries its own data-error traces.
function runInVendor(mode: string, output: string, stride: string, extra = ""): void {
	execFileSync("java", ["-Djava.awt.headless=true", "-cp", classes, "Ponomar.Golden", mode, output, stride, extra], {
		cwd: join(root, "vendor", "ponomar"),
		stdio: ["ignore", "inherit", "ignore"],
	});
}

function runFastConvert(): void {
	runInVendor("fastconvert", join(sampleDir, "fastconvert.tsv"), "1");
}

function runReadings(mode: "liturgy" | "matins"): void {
	const full = join(fullDir, `${mode}.tsv`);
	runInVendor(mode, full, "1", DAY_YEARS);
	const lines = readFileSync(full, "utf8").replace(/\r?\n$/, "").split(/\r?\n/);
	const sample = [lines[0]!, ...lines.slice(1).filter((_, i) => i % DAY_SAMPLE_EVERY === 0)];
	writeFileSync(join(sampleDir, `${mode}.tsv`), sample.join("\n") + "\n");
}

// One row per distinct result already; the committed fixture keeps every fifth.
function runLives(): void {
	const full = join(fullDir, "lives.tsv");
	runInVendor("lives", full, "1", DAY_YEARS);
	const lines = readFileSync(full, "utf8").replace(/\r?\n$/, "").split(/\r?\n/);
	const sample = [lines[0]!, ...lines.slice(1).filter((_, i) => i % DAY_SAMPLE_EVERY === 0)];
	writeFileSync(join(sampleDir, "lives.tsv"), sample.join("\n") + "\n");
}

// Small enough to commit whole.
function runNumbers(): void {
	runInVendor("numbers", join(sampleDir, "numbers.tsv"), "1");
}

// Every third day keeps the run short; the composer's inputs change slowly through the year.
function runPrimes(): void {
	runInVendor("primes", join(sampleDir, "primes.tsv"), "3", DAY_YEARS);
}

// Every prayer, command and title file any language has, read in each language so that fallback is checked too.
async function runTexts(): Promise<void> {
	const keys = new Set<string>();
	for (const load of Object.values(PRAYER_LOADERS)) {
		for (const key of Object.keys((await load()).PRAYERS)) {
			keys.add(key);
		}
	}
	const keysFile = join(fullDir, "prayer-keys.txt");
	writeFileSync(keysFile, [...keys].sort().join("\n") + "\n");
	runInVendor("texts", join(sampleDir, "texts.tsv"), "1", keysFile);
}

try {
	const sources = readdirSync(upstream)
		.filter((f) => f.endsWith(".java"))
		.map((f) => join(upstream, f));
	sources.push(join(root, "scripts", "golden", "Golden.java"));
	execFileSync("javac", ["-encoding", "UTF-8", "-nowarn", "-d", classes, ...sources], { stdio: "inherit" });

	const modes = process.argv.slice(2);
	for (const mode of modes.length > 0 ? modes : ["jdate", "pascha", "pcalendar", "dsl", "day", "fastconvert", "liturgy", "matins", "lives", "numbers", "primes", "texts"]) {
		if (mode === "dsl") {
			runDsl();
		} else if (mode === "day") {
			runDay();
		} else if (mode === "fastconvert") {
			runFastConvert();
		} else if (mode === "liturgy" || mode === "matins") {
			runReadings(mode);
		} else if (mode === "lives") {
			runLives();
		} else if (mode === "numbers") {
			runNumbers();
		} else if (mode === "primes") {
			runPrimes();
		} else if (mode === "texts") {
			await runTexts();
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
