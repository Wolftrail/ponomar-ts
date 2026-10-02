// Find exact days where the composer and HTOC disagree on troparia content.
import { DAY_FACTS_BY_ISO } from "../../src/engine/dayFacts.ts";
import { computeDayContext } from "../../src/engine/day.ts";
import { getHymnsForAnyYear } from "../../src/engine/hymns.ts";
import { getOctoechosTone } from "../../src/engine/tone.ts";
import type { Hymn } from "../../src/data/dayFacts.ts";

function hymnKey(h: Hymn): string { return `${h.title}||${h.text.slice(0, 80)}`; }

for (const [iso, facts] of DAY_FACTS_BY_ISO) {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	const ctx = computeDayContext({ year: y, month: m, day: d });
	const tone = getOctoechosTone(ctx);
	const got = getHymnsForAnyYear(ctx, tone);
	for (const kind of ["troparia", "kontakia"] as const) {
		const expList = facts[kind];
		const gotList = got[kind];
		const expSet = new Map<string, number>();
		for (const h of expList) expSet.set(hymnKey(h), (expSet.get(hymnKey(h)) ?? 0) + 1);
		const gotSet = new Map<string, number>();
		for (const h of gotList) gotSet.set(hymnKey(h), (gotSet.get(hymnKey(h)) ?? 0) + 1);
		const extras: string[] = [];
		for (const [k, n] of gotSet) {
			const e = expSet.get(k) ?? 0;
			if (e < n) extras.push(`+${n - e} ${k.slice(0, 100)}`);
		}
		const missing: string[] = [];
		for (const [k, n] of expSet) {
			const g = gotSet.get(k) ?? 0;
			if (g < n) missing.push(`-${n - g} ${k.slice(0, 100)}`);
		}
		if (extras.length === 0 && missing.length === 0) continue;
		console.log(`\n${iso} ${kind} (${gotList.length} got / ${expList.length} exp)`);
		for (const e of extras) console.log(`  ${e}`);
		for (const m of missing) console.log(`  ${m}`);
	}
}
