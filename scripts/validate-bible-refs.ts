// Corpus sweep: every unique `Reading=` and `Verses=` value in the vendor
// XML tree should parse cleanly. Run as: `node --experimental-strip-types
// scripts/validate-bible-refs.ts` from the repo root.

import { readdirSync, readFileSync, statSync } from "node:fs";
import * as path from "node:path";
import { parseBibleRef } from "../src/bible/index.ts";

const ROOT = path.join("vendor", "ponomar", "Ponomar", "languages", "xml");
const READING_RE = /(?<![A-Za-z])(?:Reading|Verses)="([^"]+)"/g;

const refs = new Set<string>();
walk(ROOT);

let ok = 0;
let bad = 0;
const failures: string[] = [];
for (const raw of refs) {
	// Skip lectionary index forms (Ap_270 / Ev_1 / getReading=…) — the
	// parser is specifically for chapter:verse citations.
	if (/^(Ap|Ev)_\d+$/.test(raw)) continue;
	if (raw.startsWith("getReading=")) continue;
	try {
		parseBibleRef(raw);
		ok++;
	} catch (e) {
		bad++;
		failures.push(`${raw}  -->  ${(e as Error).message}`);
	}
}
console.log(`corpus refs: ${refs.size} unique`);
console.log(`  parsed OK: ${ok}`);
console.log(`  failed:    ${bad}`);
for (const f of failures.slice(0, 40)) console.log("  ! " + f);
if (bad > 0) process.exit(1);

function walk(dir: string): void {
	for (const entry of readdirSync(dir)) {
		const full = path.join(dir, entry);
		const st = statSync(full);
		if (st.isDirectory()) walk(full);
		else if (full.endsWith(".xml")) collect(full);
	}
}

function collect(file: string): void {
	const src = readFileSync(file, "utf8");
	let m: RegExpExecArray | null;
	READING_RE.lastIndex = 0;
	while ((m = READING_RE.exec(src)) !== null) refs.add(m[1]!);
}
