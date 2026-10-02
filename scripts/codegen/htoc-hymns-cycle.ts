// Codegen: emits the HTOC hymn (troparion + kontakion) cycle maps.
// Classifies every hymn occurrence in the vendored 2025-2027 corpus by
// position stability:
//   fixed-julian:    same Julian MM-DD every year it appears
//   paschal-movable: same `nday` (days-from-Pascha) every year
//   sunday-tone:     Sunday-only occurrences, same resurrectional tone
//   unstable:        skipped (DOW-shift / per-year transfer; not reproducible)
//
// Emits three cycle maps covering ~93% of occurrences, so out-of-window
// years get near-full HTOC propers fidelity. Mirror of
// `htoc-fixed-commemorations.ts` + `htoc-paschal-movables.ts` for hymns.
//
// Run:   node --experimental-strip-types scripts/codegen/htoc-hymns-cycle.ts
// Emits: src/data/htocHymnsCycle.ts

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { HTOC_DAY_FACTS_BY_ISO } from "../../src/data/htocDayFacts.ts";
import type { HtocHymn } from "../../src/data/htocDayFacts.ts";
import { computeDayContext } from "../../src/engine/day.ts";

const OUTPUT = resolve(process.cwd(), "src/data/htocHymnsCycle.ts");

type HymnKind = "trop" | "kont";

interface Occurrence {
	readonly julianKey: string;
	readonly nday: number;
	readonly dow: number;
	readonly tone: number | null;
	readonly year: number;
	readonly group: number;
	readonly kind: HymnKind;
	readonly hymn: HtocHymn;
}

function hymnIdentity(h: HtocHymn, kind: HymnKind): string {
	const slugs = h.saints.map((s) => s.slug).sort().join(",");
	return `${kind}|${h.title}|${h.text}|${slugs}`;
}

const occurrences: Occurrence[] = [];
for (const [iso, facts] of HTOC_DAY_FACTS_BY_ISO) {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	const ctx = computeDayContext({ year: y, month: m, day: d });
	const julianKey = `${String(ctx.julian.month).padStart(2, "0")}-${String(ctx.julian.day).padStart(2, "0")}`;
	for (const h of facts.troparia) {
		occurrences.push({ julianKey, nday: ctx.nday, dow: ctx.dow, tone: facts.tone, year: y, group: h.group, kind: "trop", hymn: h });
	}
	for (const h of facts.kontakia) {
		occurrences.push({ julianKey, nday: ctx.nday, dow: ctx.dow, tone: facts.tone, year: y, group: h.group, kind: "kont", hymn: h });
	}
}

const byIdentity = new Map<string, Occurrence[]>();
for (const o of occurrences) {
	const id = hymnIdentity(o.hymn, o.kind);
	if (!byIdentity.has(id)) byIdentity.set(id, []);
	byIdentity.get(id)!.push(o);
}

type Classification = "fixed-julian" | "paschal-movable" | "sunday-tone" | "unstable";

interface Bucket {
	readonly cls: Classification;
	readonly key: string;
	readonly group: number;
	readonly kind: HymnKind;
	readonly hymn: HtocHymn;
}

const buckets: Bucket[] = [];
let unstable = 0;
for (const [, group] of byIdentity) {
	const julianKeys = new Set(group.map((o) => o.julianKey));
	const ndays = new Set(group.map((o) => o.nday));
	const dows = new Set(group.map((o) => o.dow));
	const tones = new Set(group.map((o) => o.tone));
	const sample = group[0]!;
	let cls: Classification;
	let key: string;
	if (julianKeys.size === 1) {
		cls = "fixed-julian";
		key = [...julianKeys][0]!;
	} else if (ndays.size === 1) {
		cls = "paschal-movable";
		key = String([...ndays][0]!);
	} else if (
		dows.size === 1 && [...dows][0] === 0 &&
		tones.size === 1 && [...tones][0] !== null
	) {
		cls = "sunday-tone";
		key = String([...tones][0]!);
	} else {
		unstable++;
		continue;
	}
	buckets.push({ cls, key, group: sample.group, kind: sample.kind, hymn: sample.hymn });
}

/** Group buckets by (classification, key), then emit per-classification maps. */
interface Slot {
	readonly troparia: Bucket[];
	readonly kontakia: Bucket[];
}
function emptySlot(): Slot {
	return { troparia: [], kontakia: [] };
}
const fixedByJulian = new Map<string, Slot>();
const paschalByNday = new Map<string, Slot>();
const sundayByTone = new Map<string, Slot>();

for (const b of buckets) {
	const map = b.cls === "fixed-julian" ? fixedByJulian : b.cls === "paschal-movable" ? paschalByNday : sundayByTone;
	if (!map.has(b.key)) map.set(b.key, emptySlot());
	const slot = map.get(b.key)!;
	(b.kind === "trop" ? slot.troparia : slot.kontakia).push(b);
}

function sortBuckets(a: Bucket, b: Bucket): number {
	if (a.group !== b.group) return a.group - b.group;
	return a.hymn.title.localeCompare(b.hymn.title);
}

function emitHymn(h: HtocHymn): string {
	const saints = h.saints.map((s) => `{ name: ${JSON.stringify(s.name)}, slug: ${JSON.stringify(s.slug)} }`).join(", ");
	return `{ title: ${JSON.stringify(h.title)}, text: ${JSON.stringify(h.text)}, group: ${h.group}, saints: [${saints}] }`;
}

function emitMap(name: string, docLine: string, map: ReadonlyMap<string, Slot>, keyIsNumber: boolean): string {
	const keys = [...map.keys()].sort((a, b) => keyIsNumber ? Number(a) - Number(b) : a.localeCompare(b));
	const lines: string[] = [];
	lines.push(docLine);
	lines.push(`export const ${name}: ReadonlyMap<${keyIsNumber ? "number" : "string"}, { readonly troparia: readonly HtocHymn[]; readonly kontakia: readonly HtocHymn[] }> = new Map([`);
	for (const k of keys) {
		const slot = map.get(k)!;
		const t = [...slot.troparia].sort(sortBuckets).map((b) => `\t\t${emitHymn(b.hymn)},`).join("\n");
		const kn = [...slot.kontakia].sort(sortBuckets).map((b) => `\t\t${emitHymn(b.hymn)},`).join("\n");
		const keyLit = keyIsNumber ? k : JSON.stringify(k);
		lines.push(`\t[${keyLit}, {`);
		lines.push(`\t\ttroparia: [`);
		if (t) lines.push(t);
		lines.push(`\t\t],`);
		lines.push(`\t\tkontakia: [`);
		if (kn) lines.push(kn);
		lines.push(`\t\t],`);
		lines.push(`\t}],`);
	}
	lines.push(`]);`);
	return lines.join("\n");
}

const fixedCount = [...fixedByJulian.values()].reduce((n, s) => n + s.troparia.length + s.kontakia.length, 0);
const paschalCount = [...paschalByNday.values()].reduce((n, s) => n + s.troparia.length + s.kontakia.length, 0);
const sundayCount = [...sundayByTone.values()].reduce((n, s) => n + s.troparia.length + s.kontakia.length, 0);

const out: string[] = [];
out.push(`// AUTO-GENERATED by scripts/codegen/htoc-hymns-cycle.ts — do not edit by hand.`);
out.push(`// Decomposed from HTOC_DAY_FACTS_BY_ISO (2025-2027 vendored window).`);
out.push(`// Generated: ${new Date().toISOString()}`);
out.push(`// Unique hymns classified: fixed-julian=${[...buckets].filter(b=>b.cls==='fixed-julian').length} paschal-movable=${[...buckets].filter(b=>b.cls==='paschal-movable').length} sunday-tone=${[...buckets].filter(b=>b.cls==='sunday-tone').length} unstable=${unstable}`);
out.push(`// Emitted entries: fixed=${fixedCount} paschal=${paschalCount} sunday=${sundayCount}`);
out.push(``);
out.push(`import type { HtocHymn } from "./htocDayFacts.ts";`);
out.push(``);
out.push(emitMap(
	"HTOC_FIXED_HYMNS_CYCLE",
	`/** Fixed-Julian hymn cycle: keyed by Julian \`"MM-DD"\`. Covers hymns\n *  whose Julian anchor is stable across years (saint-specific propers,\n *  forefeast cycles, fixed Great Feasts). */`,
	fixedByJulian,
	false,
));
out.push(``);
out.push(emitMap(
	"HTOC_PASCHAL_HYMNS_CYCLE",
	`/** Paschal-cycle hymn cycle: keyed by \`nday\` (days from Pascha).\n *  Covers hymns whose anchor shifts with the paschalion (Triodion,\n *  Pentecostarion, movable feasts). */`,
	paschalByNday,
	true,
));
out.push(``);
out.push(emitMap(
	"HTOC_SUNDAY_TONE_HYMNS_CYCLE",
	`/** Sunday-tone hymn cycle: keyed by resurrectional tone (1..8). Covers\n *  the Octoechos resurrectional troparia and kontakia sung every Sunday\n *  of the week on that tone. */`,
	sundayByTone,
	true,
));
out.push(``);
out.push(`/** Total hymn entries in the three cycle maps. */`);
out.push(`export const HTOC_HYMNS_CYCLE_COUNT = ${fixedCount + paschalCount + sundayCount};`);
out.push(``);

writeFileSync(OUTPUT, out.join("\n"), "utf8");
console.log(`Wrote ${OUTPUT}`);
console.log(`  fixed-julian:    ${fixedByJulian.size} keys, ${fixedCount} entries`);
console.log(`  paschal-movable: ${paschalByNday.size} keys, ${paschalCount} entries`);
console.log(`  sunday-tone:     ${sundayByTone.size} keys, ${sundayCount} entries`);
console.log(`  unstable skipped: ${unstable} unique hymns`);
