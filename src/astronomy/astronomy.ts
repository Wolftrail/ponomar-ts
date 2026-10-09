// Ported from Ponomar/Sunrise.java and Ponomar/Astronomy.java (typiconman/ponomar).
// Sunrise.java is C. Schlyter's public-domain sunrise algorithm (1989, 1992) as converted by A. Andreev for Ponomar; see NOTICE.md.
// Differences: none intended. The formulas, including their quirks, are kept: the solar radius divides by the sun's right
// ascension rather than its distance, and the upper-limb correction is always applied.

import { formatNumber } from "../engine/numbers.ts";
import { getPhrase, getPhraseList } from "../data/language.ts";

const INV360 = 1 / 360;
const RADEG = 180 / Math.PI;
const DEGRAD = Math.PI / 180;

const sind = (n: number): number => Math.sin(n * DEGRAD);
const cosd = (n: number): number => Math.cos(n * DEGRAD);
const acosd = (n: number): number => RADEG * Math.acos(n);
const atan2d = (n1: number, n2: number): number => RADEG * Math.atan2(n1, n2);

/** Reduces an angle to 0..360 degrees. */
const revolution = (angle: number): number => angle - 360 * Math.floor(angle * INV360);

/** Reduces an angle to -180..180 degrees. */
const rev180 = (x: number): number => x - 360 * Math.floor(x * INV360 + 0.5);

/** Days since 0 January 2000 (Gregorian) for a Julian day number. */
const daysSinceJan0 = (jdn: number): number => jdn - 2451544;

/** The Sun's distance and true longitude `d` days after 0 January 2000. */
function sunPosition(d: number): { distance: number; longitude: number } {
	const meanAnomaly = revolution(356.047 + 0.9856002585 * d);
	const meanLongitudeOfPerihelion = 282.9404 + 4.70935e-5 * d;
	const eccentricity = 0.016709 - 1.151e-9 * d;

	const eccentricAnomaly = meanAnomaly + eccentricity * RADEG * sind(meanAnomaly) * (1 + eccentricity * cosd(meanAnomaly));
	const x = cosd(eccentricAnomaly) - eccentricity;
	const y = Math.sqrt(1 - eccentricity * eccentricity) * sind(eccentricAnomaly);

	let longitude = atan2d(y, x) + meanLongitudeOfPerihelion;
	if (longitude >= 360) {
		longitude -= 360;
	}
	return { distance: Math.sqrt(x * x + y * y), longitude };
}

/** The Sun's right ascension and declination in degrees. */
function sunRightAscensionDeclination(d: number): { rightAscension: number; declination: number } {
	const { distance, longitude } = sunPosition(d);
	const x = distance * cosd(longitude);
	let y = distance * sind(longitude);
	const obliquity = 23.4393 - 3.563e-7 * d;
	const z = y * sind(obliquity);
	y *= cosd(obliquity);
	return { rightAscension: atan2d(y, x), declination: atan2d(z, Math.sqrt(x * x + y * y)) };
}

/** Sunrise and sunset in hours UT for the day `d`, at the given place and sun altitude. */
function sunRiseSet(d: number, longitude: number, latitude: number, altitude: number): { rise: number; set: number } {
	const siderealTime = revolution(revolution(180 + 356.047 + 282.9404 + (0.9856002585 + 4.70935e-5) * d) + 180 + longitude);
	const { rightAscension, declination } = sunRightAscensionDeclination(d);
	const south = 12 - rev180(siderealTime - rightAscension) / 15;
	const radius = 0.2666 / rightAscension;
	const corrected = altitude - radius;

	// The diurnal arc the Sun traverses to reach the altitude.
	const cost = (sind(corrected) - sind(latitude) * sind(declination)) / (cosd(latitude) * cosd(declination));
	const arc = cost >= 1 ? 0 : cost <= -1 ? 12 : acosd(cost) / 15;
	return { rise: south - arc, set: south + arc };
}

/** The altitudes of the sun at "sunset" that upstream names. */
export const SUN_ALTITUDE = { default: -0.833, civil: -6, nautical: -12, amateur: -15, astronomical: -18 } as const;

export interface SunPlace {
	/** Degrees east of Greenwich. */
	readonly longitude: number;
	/** Degrees north of the equator. */
	readonly latitude: number;
	/** Hours ahead of Greenwich, whole hours as upstream takes them. */
	readonly timeZone: number;
}

export interface SunOptions {
	/** Whether daylight saving time is in force, which adds an hour. */
	readonly dst?: boolean;
	/** The sun's altitude at "sunset" in degrees; `SUN_ALTITUDE.default` (-0.833) if omitted. */
	readonly altitude?: number;
}

export interface SunTimes {
	/** Local time as hours and a decimal fraction of an hour, 0 to 24. */
	readonly sunrise: number;
	readonly sunset: number;
}

/**
 * Sunrise and sunset for a day, given as its Julian day number (which does not depend on the calendar), in local decimal hours.
 * Where the sun never rises or never sets the two times coincide (at the south point) or are twelve hours either side of it.
 */
export function getSunriseSunset(jdn: number, place: SunPlace, options: SunOptions = {}): SunTimes {
	const d = daysSinceJan0(jdn) + 0.5 - place.longitude / 360;
	const { rise, set } = sunRiseSet(d, place.longitude, place.latitude, options.altitude ?? SUN_ALTITUDE.default);
	const zone = place.timeZone + (options.dst === true ? 1 : 0);
	const wrap = (hours: number): number => {
		let value = hours + zone;
		if (value > 24) {
			value -= 24;
		}
		if (value < 0) {
			value += 24;
		}
		return value;
	};
	return { sunrise: wrap(rise), sunset: wrap(set) };
}

export interface ClockOptions {
	/** Write the hour and minute in the language's numerals (upstream's `Ideographic` setting). */
	readonly ideographic?: boolean;
}

/** A time given in decimal hours, written as the language's `TimeF` phrase asks (`HH` and `MM` stand for the hour and minute). */
export async function formatClockTime(language: string, hours: number, options: ClockOptions = {}): Promise<string> {
	let format = (await getPhrase(language, "TimeF")) ?? "";
	const hour = Math.floor(hours);
	const minute = Math.floor((hours - hour) * 60);
	if (options.ideographic === true) {
		format = format.split("HH").join(await formatNumber(language, hour));
		format = format.split("MM").join(await formatNumber(language, minute));
	} else {
		const padHour = Number.parseInt((await getPhrase(language, "PadH")) ?? "1", 10);
		const padMinute = Number.parseInt((await getPhrase(language, "PadM")) ?? "1", 10);
		format = format.split("HH").join(String(hour).padStart(padHour, "0"));
		format = format.split("MM").join(String(minute).padStart(padMinute, "0"));
	}
	return format;
}

/** Sunrise and sunset for a day as the language writes them. */
export async function getSunriseSunsetStrings(language: string, jdn: number, place: SunPlace, options: ClockOptions = {}): Promise<{ sunrise: string; sunset: string }> {
	const times = getSunriseSunset(jdn, place);
	return { sunrise: await formatClockTime(language, times.sunrise, options), sunset: await formatClockTime(language, times.sunset, options) };
}

/** The Moon's apparent ecliptic longitude in degrees on a Julian day number (Meeus, with only the four largest terms). */
export function lunarLongitude(jdn: number): number {
	const T = daysSinceJan0(jdn) / 36525;
	const lPrime = revolution(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + (T * T * T) / 538841 - (T * T * T * T) / 65194000);
	const D = revolution(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + (T * T * T) / 545868 - (T * T * T * T) / 113065000);
	const mPrime = revolution(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T - (T * T * T) / 69699 - (T * T * T * T) / 14712000);
	const E = 1 - 0.002516 * T - 0.0000074 * T * T;
	const additive = 6288774 * sind(mPrime) + 1274027 * E * sind(2 * D - mPrime) + 658314 * sind(2 * D) + 213618 * sind(2 * mPrime);
	return revolution(lPrime + additive / 1000000);
}

/** The Sun's apparent ecliptic longitude in degrees on a Julian day number (Meeus). */
export function solarLongitude(jdn: number): number {
	const T = daysSinceJan0(jdn) / 36525;
	const L0 = revolution(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
	const M = revolution(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
	const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sind(M) + (0.019993 - 0.000101 * T) * sind(2 * M) + 0.000289 * sind(3 * M);
	const L = revolution(L0 + C);
	return revolution(L - 0.00569 - 0.00478 * sind(revolution(125.04 - 1934.136 * T)));
}

/** The angle in degrees from the Sun to the Moon: 0 at new moon, 90 at first quarter, 180 at full moon. */
export function lunarAge(jdn: number): number {
	return revolution(lunarLongitude(jdn) - solarLongitude(jdn));
}

/**
 * Which of the eight phases (0 new moon, 1 waxing crescent, 2 first quarter, 3 waxing gibbous, 4 full moon, 5 waning gibbous,
 * 6 last quarter, 7 waning crescent) the day falls in, by comparing the Moon's age today and tomorrow. Undefined where upstream
 * finds none and writes "Error".
 */
export function lunarPhaseIndex(jdn: number): number | undefined {
	const today = lunarAge(jdn);
	const tomorrow = lunarAge(jdn + 1);
	if (today > tomorrow) {
		return 0;
	}
	if (today > 0 && tomorrow < 90) {
		return 1;
	}
	if (today <= 90 && tomorrow > 90) {
		return 2;
	}
	if (today > 90 && tomorrow < 180) {
		return 3;
	}
	if (today <= 180 && tomorrow > 180) {
		return 4;
	}
	if (today > 180 && tomorrow < 275) {
		return 5;
	}
	if (today <= 275 && tomorrow > 275) {
		return 6;
	}
	if (today > 275 && tomorrow > today) {
		return 7;
	}
	return undefined;
}

/** The name of the Moon's phase in the language, or "Error" where upstream finds none. */
export async function lunarPhase(language: string, jdn: number): Promise<string> {
	const index = lunarPhaseIndex(jdn);
	return index === undefined ? "Error" : ((await getPhraseList(language, "Phases"))?.[index] ?? "Error");
}
