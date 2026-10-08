// Ported from Ponomar/Matins.java and the reading assembly in Ponomar/Main.java (typiconman/ponomar).
// Differences: the result is structured data, not HTML; commemorations without a Matins reading are dropped.

import { commemorationReadings } from "./commemoration.ts";
import type { ResolvedDay } from "./day.ts";
import type { LiturgyReading } from "./liturgy.ts";

const SEQUENTIAL = -2;

interface Item {
	readonly reading: string;
	readonly rank: number;
	readonly cid: string;
}

/**
 * The Matins Gospel readings for a resolved day. Upstream hard-codes the rules (its Matins.xml is never read):
 * on a Sunday of rank above 6 outside Great Lent the sequential readings are dropped, and on any other Sunday
 * the Menaion's are.
 */
export async function getMatinsReadings(day: ResolvedDay, language: string): Promise<readonly LiturgyReading[]> {
	const items: Item[] = [];
	for (const part of [day.menaion, day.paschal]) {
		for (const commemoration of part.commemorations) {
			const readings = await commemorationReadings(commemoration.cid, language, "matins", day.variables);
			if (Object.keys(readings).length > 0) {
				items.push({ reading: (readings["matins"] ?? readings["1"])?.reading ?? "", rank: commemoration.rank, cid: commemoration.cid });
			}
		}
	}

	const { dow, nday } = day.variables as { dow: number; nday: number };
	let daily = items.filter((item) => item.rank === SEQUENTIAL);
	let menaion = items.filter((item) => item.rank !== SEQUENTIAL);
	if (dow === 0 && day.rank > 6 && (nday < -49 || nday > 0)) {
		daily = [];
	} else if (dow === 0 && day.rank <= 6) {
		menaion = [];
	}

	return [
		...daily.map((item) => ({ reading: item.reading, rank: item.rank, weekday: dow })),
		...menaion.map((item) => ({ reading: item.reading, rank: item.rank, commemoration: item.cid })),
	].filter((item) => item.reading !== "");
}
