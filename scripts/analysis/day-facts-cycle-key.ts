// Validation experiment for rc.12: can `(julianMMDD, ndayF)` serve as a
// collision-free cycle key for HTOC day facts across the 3-year vendored
// window? If yes, we can expose a year-independent lookup. Reports collision
// counts for several candidate key schemes.

import { DAY_FACTS_BY_ISO } from "../../src/data/dayFacts.ts";
import type { DayFacts } from "../../src/data/dayFacts.ts";
import { computeDayContext } from "../../src/engine/day.ts";

type KeyFn = (iso: string, ctx: ReturnType<typeof computeDayContext>) => string;

const candidates: Record<string, KeyFn> = {
	"julMMDD,ndayF": (_iso, ctx) => `${ctx.julian.month}-${ctx.julian.day},${ctx.ndayF}`,
	"julMMDD,ndayP": (_iso, ctx) => `${ctx.julian.month}-${ctx.julian.day},${ctx.ndayP}`,
	"julMMDD,nday": (_iso, ctx) => `${ctx.julian.month}-${ctx.julian.day},${ctx.nday}`,
	"doy,ndayF": (_iso, ctx) => `${ctx.doy},${ctx.ndayF}`,
	"doy,ndayP": (_iso, ctx) => `${ctx.doy},${ctx.ndayP}`,
	"julMMDD,ndayF,dow": (_iso, ctx) =>
		`${ctx.julian.month}-${ctx.julian.day},${ctx.ndayF},${ctx.dow}`,
};

function sig(f: DayFacts): string {
	return JSON.stringify(f);
}

for (const [name, keyFn] of Object.entries(candidates)) {
	const buckets = new Map<string, { iso: string; facts: DayFacts }[]>();
	for (const [iso, facts] of DAY_FACTS_BY_ISO) {
		const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
		const ctx = computeDayContext({ year: y, month: m, day: d });
		const k = keyFn(iso, ctx);
		let bucket = buckets.get(k);
		if (bucket === undefined) {
			bucket = [];
			buckets.set(k, bucket);
		}
		bucket.push({ iso, facts });
	}
	let distinct = 0;
	let collisionBuckets = 0;
	let daysInCollision = 0;
	const sampleCollisions: string[] = [];
	for (const [k, arr] of buckets) {
		distinct++;
		if (arr.length < 2) continue;
		const first = sig(arr[0]!.facts);
		let anyDiffer = false;
		for (let i = 1; i < arr.length; i++) {
			if (sig(arr[i]!.facts) !== first) {
				anyDiffer = true;
				break;
			}
		}
		if (anyDiffer) {
			collisionBuckets++;
			daysInCollision += arr.length;
			if (sampleCollisions.length < 3) {
				sampleCollisions.push(`${k} <- [${arr.map((e) => e.iso).join(", ")}]`);
			}
		}
	}
	console.log(
		name.padEnd(22),
		"distinct keys:",
		String(distinct).padStart(5),
		"  collision buckets:",
		String(collisionBuckets).padStart(4),
		"  days in collision:",
		String(daysInCollision).padStart(4),
	);
	for (const s of sampleCollisions) console.log("     ", s);
}
