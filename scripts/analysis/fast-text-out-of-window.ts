// Out-of-window fastText probe. Runs `getLiturgicalDay` for every day
// in 2028-2030, counts how many hit the HTOC pivot vs. fall back to the
// Ponomar-driven `renderFastText`, and dumps a few landmark dates.

import { getLiturgicalDay } from "../../src/engine/index.ts";
import { getHtocFastTextForAnyYear } from "../../src/engine/htocFastText.ts";
import { computeDayContext } from "../../src/engine/day.ts";

interface Bucket {
	readonly year: number;
	readonly total: number;
	readonly pivotHits: number;
	readonly fallbackHits: number;
	readonly empty: number;
}

const years = [2028, 2029, 2030];
const buckets: Bucket[] = [];

for (const y of years) {
	let total = 0;
	let pivotHits = 0;
	let fallbackHits = 0;
	let empty = 0;
	const start = new Date(Date.UTC(y, 0, 1));
	const end = new Date(Date.UTC(y + 1, 0, 1));
	for (let t = start.getTime(); t < end.getTime(); t += 86400000) {
		const d = new Date(t);
		const greg = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
		const ctx = computeDayContext(greg);
		const pivot = getHtocFastTextForAnyYear(ctx);
		const day = getLiturgicalDay(greg);
		total++;
		if (pivot !== null) pivotHits++;
		else if (day.fastText !== "") fallbackHits++;
		else empty++;
	}
	buckets.push({ year: y, total, pivotHits, fallbackHits, empty });
}

console.log("=== Out-of-window fastText composer coverage ===");
for (const b of buckets) {
	const pct = ((b.pivotHits / b.total) * 100).toFixed(1);
	console.log(`${b.year}: total=${b.total} pivot=${b.pivotHits} (${pct}%) fallback=${b.fallbackHits} empty=${b.empty}`);
}

const landmarks: Array<{ label: string; date: { year: number; month: number; day: number } }> = [
	{ label: "Jan 1 2028 (Nativity Fast)", date: { year: 2028, month: 1, day: 1 } },
	{ label: "Mar 15 2028 (Great Lent Wed)", date: { year: 2028, month: 3, day: 15 } },
	{ label: "Apr 7 2028 (Annunciation)", date: { year: 2028, month: 4, day: 7 } },
	{ label: "Jun 20 2028 (Apostles' Fast weekday)", date: { year: 2028, month: 6, day: 20 } },
	{ label: "Aug 10 2028 (Dormition Fast weekday)", date: { year: 2028, month: 8, day: 10 } },
	{ label: "Aug 14 2028 (Eve of Dormition)", date: { year: 2028, month: 8, day: 14 } },
	{ label: "Nov 15 2028 (Nativity Fast start)", date: { year: 2028, month: 11, day: 15 } },
	{ label: "Dec 24 2028 (Eve of Nativity)", date: { year: 2028, month: 12, day: 24 } },
	{ label: "Dec 25 2028 (Nativity)", date: { year: 2028, month: 12, day: 25 } },
	{ label: "Jul 3 2028 (ordinary Monday)", date: { year: 2028, month: 7, day: 3 } },
];
console.log("\n=== Landmark 2028 days ===");
for (const { label, date } of landmarks) {
	const day = getLiturgicalDay(date);
	console.log(`${label.padEnd(42)} → ${JSON.stringify(day.fastText)}`);
}
