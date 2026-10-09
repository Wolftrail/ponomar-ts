// Packs the package, installs the tarball into a temp project and exercises every public entry point.
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const npmCli = process.env["npm_execpath"];
if (!npmCli) throw new Error("run through `npm run smoke`");
const run = (args: string[], cwd: string): string =>
	execFileSync(process.execPath, [npmCli, ...args], { cwd, encoding: "utf8" });

const work = await mkdtemp(join(tmpdir(), "ponomar-smoke-"));
try {
	const packOut = run(["pack", "--json", "--pack-destination", work], root);
	const [info] = JSON.parse(packOut.slice(packOut.indexOf("["))) as { filename: string; size: number }[];
	if (!info) throw new Error("npm pack produced no tarball");
	const tarball = join(work, info.filename);
	const packed = (await stat(tarball)).size;
	console.log(`tarball ${info.filename}: ${(packed / 1048576).toFixed(2)} MB`);

	const project = join(work, "consumer");
	await writeFile(join(work, "package.json"), "{}");
	run(["install", "--prefix", project, tarball, "--no-audit", "--no-fund", "--loglevel=error"], work);

	const script = join(project, "check.mjs");
	await writeFile(
		script,
		`import * as root from "ponomar-ts";
import { getPascha } from "ponomar-ts/paschalion";
import { getSunriseSunset } from "ponomar-ts/astronomy";
import { parseBibleReference } from "ponomar-ts/bible";
import { evaluate } from "ponomar-ts/dsl";
import { createRequire } from "node:module";

const day = await root.resolveDay({ date: { year: 2026, month: 3, day: 15 }, language: "en", gospelScheme: 0 });
if (!day.menaion.commemorations.length) throw new Error("no commemorations");
const liturgy = await root.getLiturgyReadings(day, "en");
if (!liturgy) throw new Error("no liturgy readings");
for (const language of ["cu/ru", "el/mono", "fr"]) {
	await root.resolveDay({ date: { year: 2026, month: 3, day: 15 }, language, gospelScheme: 0 });
}
if (!getPascha(2026)) throw new Error("pascha");
if (typeof getSunriseSunset !== "function") throw new Error("astronomy");
if (parseBibleReference("I Cor_4:13-17").book !== "I_Cor") throw new Error("bible");
if (typeof evaluate !== "function") throw new Error("dsl");
createRequire(import.meta.url)("ponomar-ts/package.json");
console.log("ok");
`,
	);
	console.log(execFileSync(process.execPath, [script], { cwd: project, encoding: "utf8" }).trim());

	const maps = (await readdir(join(project, "node_modules", "ponomar-ts", "dist", "data", "generated"), { recursive: true })).filter(
		(name) => name.endsWith(".map"),
	);
	if (maps.length) throw new Error(`generated source maps shipped: ${maps.length}`);
} finally {
	await rm(work, { recursive: true, force: true });
}
