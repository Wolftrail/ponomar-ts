// Measure dedup headroom in saints.ts entry pool.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface Raw {
	readonly href: string;
	readonly cycle: "fixed" | "movable";
	readonly names: readonly string[];
	readonly ranks: readonly string[];
	readonly texts: readonly string[];
	readonly dates: readonly string[];
}

const raw = JSON.parse(
	readFileSync(resolve("scratch/htoc-saints.json"), "utf8"),
) as { readonly saints: readonly Raw[] };

const entries = new Set<string>();
const texts = new Set<string>();
const names = new Set<string>();
const slugs = new Set<string>();
const ranks = new Set<string>();
let totalEntries = 0;
let bytes_slug = 0, bytes_text = 0, bytes_names = 0;
for (const s of raw.saints) {
	const m = s.href.match(/\/los\/([^/]+\/[^.]+)/);
	const slug = m?.[1] ?? s.href;
	const rank = s.ranks[0] ?? "0";
	const text = s.texts[0] ?? "";
	const nn = JSON.stringify(s.names);
	const key = `${slug}\x01${s.cycle}\x01${rank}\x01${text}\x01${nn}`;
	entries.add(key);
	texts.add(text);
	names.add(nn);
	slugs.add(slug);
	ranks.add(rank);
	totalEntries++;
	bytes_slug += slug.length + 2;
	bytes_text += text.length + 2;
	bytes_names += nn.length;
}

console.log(`total saints: ${totalEntries}`);
console.log(`unique entry tuples: ${entries.size}`);
console.log(`unique texts: ${texts.size}  (bytes if pooled: ${[...texts].reduce((n,s)=>n+s.length+2,0)}, inlined approx: ${bytes_text})`);
console.log(`unique names arrays: ${names.size}  (bytes if pooled: ${[...names].reduce((n,s)=>n+s.length,0)}, inlined approx: ${bytes_names})`);
console.log(`unique slugs: ${slugs.size}  (dedup headroom ${(100*(1-slugs.size/totalEntries)).toFixed(1)}%)`);
console.log(`unique rank glyphs: ${ranks.size}`);

const top = <T>(m: Map<T, number>, n = 5) =>
	[...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

const textCounts = new Map<string, number>();
for (const s of raw.saints) {
	const t = s.texts[0] ?? "";
	textCounts.set(t, (textCounts.get(t) ?? 0) + 1);
}
console.log("\ntop 5 most-shared texts:");
for (const [t, c] of top(textCounts)) console.log(`  (×${c}) ${JSON.stringify(t.slice(0, 100))}`);

const nameCounts = new Map<string, number>();
for (const s of raw.saints) {
	const nn = JSON.stringify(s.names);
	nameCounts.set(nn, (nameCounts.get(nn) ?? 0) + 1);
}
console.log("\ntop 5 most-shared names arrays:");
for (const [n, c] of top(nameCounts)) console.log(`  (×${c}) ${n.slice(0, 100)}`);
