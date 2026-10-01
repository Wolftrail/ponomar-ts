// Liturgical-season classifier + week counters for the ordinary/Lenten/
// Paschal cycles. All values are derived from `DayContext` (nday / ndayP /
// dow / julian), with HTOC conventions as the reference truth.

import type { DayContext } from "./day.ts";

/** Named "season" bucket a day belongs to. Granular enough to drive the
 *  HTOC header renderer and the fast-season engine. */
export type SeasonKind =
	// After-Pentecost / pre-Pub&Pharisee ordinary time; also pre-Pascha
	// weeks that still count by "Nth Sunday after Pentecost".
	| "ordinary"
	// Pre-Lent triodion (Pub&Pharisee through Forgiveness Sunday).
	| "publican-and-pharisee-sunday"      // nday = -70
	| "fast-free-week"                    // nday = -69..-64 (week after Pub&Pharisee)
	| "prodigal-son-sunday"               // nday = -63
	| "meatfare-week"                     // nday = -62..-58 (Mon-Fri)
	| "saturday-of-the-dead"              // nday = -57 (Sat before Meatfare)
	| "last-judgment-sunday"              // nday = -56 (Meatfare Sunday)
	| "cheesefare-week"                   // nday = -55..-50 (Maslenitsa)
	| "forgiveness-sunday"                // nday = -49 (Cheesefare Sunday)
	// Great Lent (6 weeks of Lenten weekday + Sunday, closes at Fri -9).
	| "great-lent"                        // nday = -48..-9
	// Lazarus Saturday + Holy Week + Pascha + Bright Week.
	| "lazarus-saturday"                  // nday = -8
	| "palm-sunday"                       // nday = -7
	| "holy-week"                         // nday = -6..-1
	| "pascha"                            // nday = 0
	| "bright-week"                       // nday = 1..6
	// Pentecostarion (Thomas Sunday through Apodosis of Pentecost).
	| "antipascha"                        // nday = 7
	| "pentecostarion"                    // nday = 8..48
	| "pentecost"                         // nday = 49
	| "pentecost-week";                   // nday = 50..55 (fast-free week after Pentecost)

/**
 * Classify `ctx` into one of ~20 named liturgical-season buckets. The buckets
 * are the ones HTOC uses to drive its header text and seasonal fast marker.
 */
export function getLiturgicalSeason(ctx: DayContext): SeasonKind {
	const n = ctx.nday;
	if (n === -70) return "publican-and-pharisee-sunday";
	if (n >= -69 && n <= -64) return "fast-free-week";
	if (n === -63) return "prodigal-son-sunday";
	if (n >= -62 && n <= -58) return "meatfare-week";
	if (n === -57) return "saturday-of-the-dead";
	if (n === -56) return "last-judgment-sunday";
	if (n >= -55 && n <= -50) return "cheesefare-week";
	if (n === -49) return "forgiveness-sunday";
	if (n >= -48 && n <= -9) return "great-lent";
	if (n === -8) return "lazarus-saturday";
	if (n === -7) return "palm-sunday";
	if (n >= -6 && n <= -1) return "holy-week";
	if (n === 0) return "pascha";
	if (n >= 1 && n <= 6) return "bright-week";
	if (n === 7) return "antipascha";
	if (n >= 8 && n <= 48) return "pentecostarion";
	if (n === 49) return "pentecost";
	if (n >= 50 && n <= 55) return "pentecost-week";
	return "ordinary";
}

/** Compute "Nth Sunday after Pentecost" / "Nth Week after Pentecost" index,
 *  continuing across the civil-year boundary. Returns an integer >= 1.
 *  Only meaningful during `"ordinary"` season — behaviour is undefined for
 *  callers outside that range (will still produce a number by extrapolation). */
export function getPentecostWeek(ctx: DayContext): number {
	const n = ctx.nday >= 56 ? ctx.nday : ctx.ndayP;
	const past = n - 49;
	if (ctx.dow === 0) return Math.floor(past / 7);
	return Math.floor(past / 7) + 1;
}

/** Compute "Nth Week of Great Lent" / "Nth Sunday of Great Lent" index,
 *  1..6. Only meaningful during Great Lent, Lazarus Saturday, or the
 *  Lenten precursor Sundays — undefined otherwise. */
export function getLentenWeek(ctx: DayContext): number {
	const past = ctx.nday + 48;
	if (ctx.dow === 0) return Math.floor(past / 7) + 1;
	return Math.floor(past / 7) + 1;
}

/** True on the Julian Dec 25 – Jan 4 Nativity Afterfeast span, during which
 *  HTOC appends the `"Sviatki. Fast-free"` marker to its header. */
export function isSviatki(ctx: DayContext): boolean {
	const { month, day } = ctx.julian;
	if (month === 12 && day >= 25) return true;
	if (month === 1 && day <= 4) return true;
	return false;
}
