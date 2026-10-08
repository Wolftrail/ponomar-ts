// Ported from Ponomar/Commemoration1.java getRank() and readCommemoration() (typiconman/ponomar).
// Difference: a SERVICE whose Type is not an integer (el/xml/lives/08160600.xml has a saint's name there) is
// skipped; upstream throws and abandons the commemoration's remaining files.

import { evaluateBoolean, type DslContext } from "../core/dsl/index.ts";
import { findLives } from "../data/access.ts";

const INTEGER = /^-?\d+$/;

/** Ids 9000-9899 with four digits are the Triodion and Pentecostarion's own commemorations. */
function isMovableCycleId(cid: string): boolean {
	const id = Number(cid);
	return cid.length === 4 && id >= 9000 && id < 9900;
}

/**
 * The rank of a commemoration: the last applicable SERVICE `Type` along the language chain, root first.
 * Higher is more festive; movable-cycle ids rank -2 when they have no rank or one below 2.
 */
export async function commemorationRank(cid: string, language: string, context: DslContext): Promise<number> {
	let rank: number | undefined;
	for (const life of await findLives(cid, language)) {
		for (const service of life.services) {
			if (service.cmd !== undefined && !evaluateBoolean(service.cmd, context)) {
				continue;
			}
			if (service.type !== undefined && INTEGER.test(service.type)) {
				rank = Number(service.type);
			}
		}
	}
	if (rank === undefined) {
		return isMovableCycleId(cid) ? -2 : 0;
	}
	return isMovableCycleId(cid) && rank < 2 ? -2 : rank;
}
