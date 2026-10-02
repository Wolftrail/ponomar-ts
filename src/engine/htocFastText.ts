// Compose HTOC `fastText` for any civil year by consulting the two
// position-stable cycle maps emitted by
// `scripts/codegen/htoc-fast-text-cycle.ts`. Covers 100 % of occurrences
// in the vendored 2025-2027 window; precedence (paschal → Julian) mirrors
// the codegen classifier.

import {
	HTOC_FAST_TEXT_JULIAN_CYCLE,
	HTOC_FAST_TEXT_PASCHAL_CYCLE,
} from "../data/htocFastTextCycle.ts";
import type { DayContext } from "./day.ts";

/** Look up `fastText` for any day via the cycle pivot. Returns `null`
 *  when neither axis has a stable key for the given day; callers should
 *  then fall back to the engine-level renderer. */
export function getHtocFastTextForAnyYear(ctx: DayContext): string | null {
	const paschalKey = `${ctx.nday}|${ctx.dow}`;
	const paschal = HTOC_FAST_TEXT_PASCHAL_CYCLE.get(paschalKey);
	if (paschal !== undefined) return paschal;
	const julianKey = `${String(ctx.julian.month).padStart(2, "0")}-${String(ctx.julian.day).padStart(2, "0")}|${ctx.dow}`;
	const julian = HTOC_FAST_TEXT_JULIAN_CYCLE.get(julianKey);
	if (julian !== undefined) return julian;
	return null;
}
