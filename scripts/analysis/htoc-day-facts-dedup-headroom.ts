// Measure how much dedup headroom remains in htocDayFacts beyond the
// current string/ref pools. Specifically: how many unique CH (hymn)
// and CC (commemoration) tuples are there, how many are referenced,
// and how often do whole commemorations[]/troparia[]/kontakia[] arrays
// repeat across days.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface RawHymn { readonly title: string; readonly text: string; readonly group: number; readonly saints: readonly { readonly name: string; readonly href: string }[]; }
interface RawDay { readonly troparia: readonly RawHymn[]; readonly kontakia: readonly RawHymn[]; }
interface RawCommem { readonly rank: string; readonly text: string; readonly minor: boolean; readonly lives: readonly { readonly name: string; readonly href: string }[]; }

const DAYS = JSON.parse(readFileSync(resolve("scratch/htoc-days.json"), "utf8")) as { readonly days: Readonly<Record<string, RawDay>> };
const COMMEMS = new Map<string, readonly RawCommem[]>();
for (const y of [2025, 2026, 2027]) {
	const fx = JSON.parse(readFileSync(resolve(`tests/fixtures/htoc-full-${y}.json`), "utf8")) as { readonly days: Readonly<Record<string, { readonly commemorations: readonly RawCommem[] }>> };
	for (const [iso, d] of Object.entries(fx.days)) COMMEMS.set(iso, d.commemorations ?? []);
}

function hrefToSlug(href: string): string {
	const m = href.match(/\/los\/([^/]+\/[^.]+)/);
	return m?.[1] ?? href;
}
function hymnKey(h: RawHymn): string {
	return `${h.title}\u0001${h.text}\u0001${h.group}\u0001${h.saints.map((s) => s.name + "/" + hrefToSlug(s.href)).join("\u0002")}`;
}
function commemKey(c: RawCommem): string {
	return `${c.rank}\u0001${c.text}\u0001${c.minor ? 1 : 0}\u0001${c.lives.map((l) => l.name + "/" + hrefToSlug(l.href)).join("\u0002")}`;
}
function arrKey(ks: readonly string[]): string {
	return ks.join("\u0003");
}

const uniqueHymns = new Map<string, number>();
const uniqueCommems = new Map<string, number>();
const uniqueTropArrays = new Map<string, number>();
const uniqueKontArrays = new Map<string, number>();
const uniqueCommemArrays = new Map<string, number>();
const uniqueInnerTriplets = new Map<string, number>();
let totalHymnRefs = 0;
let totalCommemRefs = 0;
let totalDays = 0;

for (const [iso, d] of Object.entries(DAYS.days)) {
	totalDays++;
	const tKeys = (d.troparia ?? []).map((h) => {
		const k = hymnKey(h);
		uniqueHymns.set(k, (uniqueHymns.get(k) ?? 0) + 1);
		totalHymnRefs++;
		return k;
	});
	const kKeys = (d.kontakia ?? []).map((h) => {
		const k = hymnKey(h);
		uniqueHymns.set(k, (uniqueHymns.get(k) ?? 0) + 1);
		totalHymnRefs++;
		return k;
	});
	const cs = COMMEMS.get(iso) ?? [];
	const cKeys = cs.map((c) => {
		const k = commemKey(c);
		uniqueCommems.set(k, (uniqueCommems.get(k) ?? 0) + 1);
		totalCommemRefs++;
		return k;
	});
	const ta = arrKey(tKeys); uniqueTropArrays.set(ta, (uniqueTropArrays.get(ta) ?? 0) + 1);
	const ka = arrKey(kKeys); uniqueKontArrays.set(ka, (uniqueKontArrays.get(ka) ?? 0) + 1);
	const ca = arrKey(cKeys); uniqueCommemArrays.set(ca, (uniqueCommemArrays.get(ca) ?? 0) + 1);
	const triplet = ca + "\u0004" + ta + "\u0004" + ka;
	uniqueInnerTriplets.set(triplet, (uniqueInnerTriplets.get(triplet) ?? 0) + 1);
}

console.log(`total days: ${totalDays}`);
console.log(`total hymn refs: ${totalHymnRefs}; unique hymn tuples: ${uniqueHymns.size} (dedup ${(100*(1-uniqueHymns.size/totalHymnRefs)).toFixed(1)}%)`);
console.log(`total commem refs: ${totalCommemRefs}; unique commem tuples: ${uniqueCommems.size} (dedup ${(100*(1-uniqueCommems.size/totalCommemRefs)).toFixed(1)}%)`);
console.log(`unique commemorations[] arrays: ${uniqueCommemArrays.size}/${totalDays} (dedup ${(100*(1-uniqueCommemArrays.size/totalDays)).toFixed(1)}%)`);
console.log(`unique troparia[] arrays:        ${uniqueTropArrays.size}/${totalDays} (dedup ${(100*(1-uniqueTropArrays.size/totalDays)).toFixed(1)}%)`);
console.log(`unique kontakia[] arrays:        ${uniqueKontArrays.size}/${totalDays} (dedup ${(100*(1-uniqueKontArrays.size/totalDays)).toFixed(1)}%)`);
console.log(`unique full-inner-triplets:      ${uniqueInnerTriplets.size}/${totalDays} (dedup ${(100*(1-uniqueInnerTriplets.size/totalDays)).toFixed(1)}%)`);

// Hot-list: top 5 most-repeated hymn tuples and commem tuples
const top = <T>(m: Map<T, number>, n = 5) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
console.log("\ntop 5 most-reused hymn tuples:");
for (const [k, c] of top(uniqueHymns)) console.log(`  (×${c}) ${k.slice(0, 80).replace(/\u0001/g, " | ")}`);
console.log("\ntop 5 most-reused commem tuples:");
for (const [k, c] of top(uniqueCommems)) console.log(`  (×${c}) ${k.slice(0, 80).replace(/\u0001/g, " | ")}`);
