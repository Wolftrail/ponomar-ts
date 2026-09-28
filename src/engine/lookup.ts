// Given a DayContext, pull the raw `DayEntry` rows from the generated data
// modules for the Paschal cycle (pentecostarion or triodion) and the fixed
// Menaion, if present. Both entries are optional: the vendor may not have
// data for every calendar slot.

import type { DayEntry } from "../data/index.ts";
import { MENAION, PENTECOSTARION, TRIODION } from "../data/index.ts";
import type { DayContext } from "./day.ts";

/** Selection of Paschal-cycle DayEntry for a given `nday` / `ndayP`. */
export function selectPaschalCycleEntry(ctx: DayContext): DayEntry | null {
	// After Pascha, through Pentecost and beyond, up to ~245 days out.
	if (ctx.nday >= 0 && ctx.nday < PENTECOSTARION.length) {
		return PENTECOSTARION[ctx.nday] ?? null;
	}
	// Pre-Lent through Holy Saturday: negative nday, indexed by absolute value.
	if (ctx.nday >= -70 && ctx.nday < 0) {
		const idx = Math.abs(ctx.nday) - 1;
		return TRIODION[idx] ?? null;
	}
	// After Pentecost / before Triodion opens: fall back to previous year's
	// Pascha cycle. `ndayP` is days since previous-year Pascha.
	if (ctx.nday < -70 && ctx.ndayP >= 0 && ctx.ndayP < PENTECOSTARION.length) {
		return PENTECOSTARION[ctx.ndayP] ?? null;
	}
	return null;
}

/** Menaion entry keyed by Julian MM-DD; may be absent for days without data. */
export function selectMenaionEntry(ctx: DayContext): DayEntry | null {
	const mm = ctx.julian.month.toString().padStart(2, "0");
	const dd = ctx.julian.day.toString().padStart(2, "0");
	return MENAION[`${mm}-${dd}`] ?? null;
}
