// HTOC-faithful `headerText` renderer. Composes title + tone + seasonal
// marker + fast marker into the exact string HTOC prints on each day page.
//
// Validated against the 1095-day vendored corpus (2025-2027) — see
// `scripts/analysis/header-validate.ts`.

import type { DayContext } from "./day.ts";
import {
	getLentenWeek,
	getLiturgicalSeason,
	getPentecostWeek,
	isSviatki,
	type SeasonKind,
} from "./season.ts";
import { getOctoechosTone } from "./tone.ts";

const TONE_NAMES = ["one", "two", "three", "four", "five", "six", "seven", "eight"] as const;
const LENT_WORDS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"] as const;

function ord(n: number): string {
	const mod100 = n % 100;
	const mod10 = n % 10;
	let suffix: string;
	if (mod100 >= 11 && mod100 <= 13) suffix = "th";
	else if (mod10 === 1) suffix = "st";
	else if (mod10 === 2) suffix = "nd";
	else if (mod10 === 3) suffix = "rd";
	else suffix = "th";
	return `${n} ${suffix}`;
}

function toneSegment(tone: number | null): string {
	if (tone === null) return "";
	return ` Tone ${TONE_NAMES[tone - 1]}.`;
}

/** Render the HTOC `headerText` line for `ctx`. */
export function renderHeaderText(ctx: DayContext): string {
	const season = getLiturgicalSeason(ctx);
	const tone = getOctoechosTone(ctx);
	const title = renderTitle(ctx, season);
	const seasonal = renderSeasonal(ctx, season);
	return `${title}${toneSegment(tone)}${seasonal}`;
}

function renderTitle(ctx: DayContext, season: SeasonKind): string {
	switch (season) {
		case "publican-and-pharisee-sunday":
			return "Sunday of the Publican and the Pharisee.";
		case "fast-free-week":
			return "A fast-free week.";
		case "prodigal-son-sunday":
			return "Sunday of the Prodigal Son.";
		case "meatfare-week":
			return "Meatfare week.";
		case "saturday-of-the-dead":
			return "The Saturday of the Dead.";
		case "last-judgment-sunday":
			return "Sunday of the Last Judgment (Meatfare).";
		case "cheesefare-week":
			return "Cheesefare week (Maslenitsa) - fast-free.";
		case "forgiveness-sunday":
			return "The Sunday of Forgiveness.";
		case "great-lent":
			return renderLentTitle(ctx);
		case "lazarus-saturday":
			return "Lazarus Saturday.";
		case "palm-sunday":
			return "The Entry of the Lord into Jerusalem.";
		case "holy-week":
			return renderHolyWeekTitle(ctx);
		case "pascha":
			return "The Bright Resurrection of Christ, The Pascha of the Lord. The End of the Great Lent.";
		case "bright-week":
			return renderBrightWeekTitle(ctx);
		case "antipascha":
			return "Second Sunday of Pascha: Antipascha, St. Thomas Sunday.";
		case "pentecostarion":
			return renderPentecostarionTitle(ctx);
		case "pentecost":
			return "Pentecost \u2013 Trinity Sunday.";
		case "pentecost-week":
			return renderPentecostWeekTitle(ctx);
		case "ordinary":
			return renderOrdinaryTitle(ctx);
	}
}

function renderLentTitle(ctx: DayContext): string {
	const week = getLentenWeek(ctx);
	// nday = -48 is "Beginning of the Great Lent" (Clean Monday).
	if (ctx.nday === -48) return "Beginning of the Great Lent.";
	const weekWord = LENT_WORDS[week - 1]!;
	if (ctx.dow === 0) {
		// Named lenten Sundays.
		if (week === 1) return "First Sunday of the Great Lent: Triumph of Orthodoxy.";
		if (week === 3) return "Third Sunday of the Great Lent: Adoration of Cross.";
		return `${weekWord} Sunday of the Great Lent.`;
	}
	if (ctx.dow === 6) {
		// Named lenten Saturdays.
		if (week === 5) return "Fifth Saturday of the Great Lent: Laudation of the Mother of God.";
		return `${weekWord} Saturday of the Great Lent.`;
	}
	// Weekday Mon-Fri.
	if (week === 4) return "Fourth Week of the Great Lent: Adoration of Cross.";
	return `${weekWord} Week of the Great Lent.`;
}

function renderHolyWeekTitle(ctx: DayContext): string {
	switch (ctx.nday) {
		case -6: return "Passion Week: Great Monday.";
		case -5: return "Passion Week: Great Tuesday.";
		case -4: return "Passion Week: Great Wednesday.";
		case -3: return "Passion Week: Great Thursday.";
		case -2: return "Passion Week: Great Friday, Passion of Jesus Christ.";
		case -1: return "Passion Week: Great Saturday, descent into Hades.";
		default: return "Passion Week.";
	}
}

function renderBrightWeekTitle(ctx: DayContext): string {
	const names = ["", "Bright Monday.", "Bright Tuesday.", "Bright Wednesday.",
		"Bright Thursday.", "Bright Friday.", "Bright Saturday."];
	return names[ctx.nday] ?? "Bright Week.";
}

function renderPentecostarionTitle(ctx: DayContext): string {
	const n = ctx.nday;
	// Named Sundays.
	if (n === 14) return "Third Sunday of Pascha: The Myrrh-bearing Women.";
	if (n === 21) return "Fourth Sunday of Pascha: The Paralyzed Man.";
	if (n === 28) return "Fifth Sunday of Pascha: The Samaritan Woman.";
	if (n === 35) return "Sixth Sunday of Pascha: The Blind Man.";
	if (n === 42) return "Seventh Sunday of Pascha: The Fathers of the First Ecumenical Council.";
	// Named weekdays.
	if (n === 9 && ctx.dow === 2) return "Radonitsa, or Day of Rejoicing. Commemoration of the Dead.";
	if (n === 24 && ctx.dow === 3) return "Mid-Pentecost or Prepolovenie.";
	if (n === 31 && ctx.dow === 3) return "Apodosis of Prepolovenie.";
	if (n === 38 && ctx.dow === 3) return "Apodosis of Pascha.";
	if (n === 39) return "The Ascension of our Lord.";
	if (n >= 40 && n <= 46) return "Afterfeast of the Ascension.";
	if (n === 47) return "Apodosis of the Ascension.";
	if (n === 48) return "Commemoration of the Dead.";
	// Generic "Nth Week of Pascha". N = floor(n/7) + 1 for weeks 2..6.
	// Thomas week = Week 2 (nday 8..13), Myrrh = Week 3 (nday 15..20), etc.
	const week = Math.floor(n / 7) + 1;
	const word = LENT_WORDS[week - 1];
	return `${word ?? ord(week)} Week of Pascha.`;
}

function renderPentecostWeekTitle(ctx: DayContext): string {
	switch (ctx.nday) {
		case 50: return "Day Of the Holy Spirit.";
		case 51: return "Third Day of the Holy Trinity.";
		case 55: return "Apodosis of Pentecost.";
		default: return "Afterfeast of Pentecost.";
	}
}

function renderOrdinaryTitle(ctx: DayContext): string {
	const n = getPentecostWeek(ctx);
	// All Saints Sunday + All Russian Saints are named Sundays.
	if (ctx.nday === 56) return "1 st Sunday after Pentecost. All Saints.";
	if (ctx.nday === 63) return "2 nd Sunday after Pentecost. All Russian Saints.";
	if (ctx.dow === 0) return `${ord(n)} Sunday after Pentecost.`;
	return `${ord(n)} Week after Pentecost.`;
}

function renderSeasonal(ctx: DayContext, season: SeasonKind): string {
	// Fixed per-season suffixes (fast-markers).
	switch (season) {
		case "cheesefare-week":
			return " Maslenitsa. Meat is excluded";
		case "forgiveness-sunday":
			return " Cheesefare Sunday. Meat is excluded";
		case "bright-week":
			return " Bright Week. Fast-free";
		case "pentecost-week":
			return " Fast-free Week. Fast-free";
		case "fast-free-week":
			return " Fast-free Week. Fast-free";
	}
	// Sviatki appears only on ordinary-time days (Julian Dec 25 – Jan 4).
	if (isSviatki(ctx) && season === "ordinary") {
		return " Sviatki. Fast-free";
	}
	return "";
}
