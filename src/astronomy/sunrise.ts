// Ported from Ponomar/Sunrise.java (which is itself a port of Paul Schlyter's
// public-domain SUNRISET.C, 1992). Computes sunrise/sunset for any latitude,
// longitude and civil date. Standalone — no dependency on the rest of the
// engine.

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { _internal } from "../core/calendar/jdate.ts";

/** Standard altitude constants (in degrees below the horizon) accepted as
 *  `altitude` in {@link SunriseSunsetOptions}. */
export const SunAltitude = {
	/** Sun's upper limb touches horizon with atmospheric refraction (default). */
	DEFAULT: -0.833,
	/** Civil twilight — reading outside without artificial light is no longer possible. */
	CIVIL: -6,
	/** Nautical twilight. */
	NAUTICAL: -12,
	/** Amateur astronomical twilight. */
	AMATEUR: -15,
	/** Astronomical twilight — sky completely dark. */
	ASTRONOMICAL: -18,
} as const;

export interface SunriseSunsetOptions {
	/** East longitude positive, west negative. Degrees. */
	readonly longitude: number;
	/** North latitude positive, south negative. Degrees. */
	readonly latitude: number;
	/** Local timezone offset from UTC in hours (positive east). */
	readonly tzOffsetHours: number;
	/** If true, add 1 hour for daylight-saving. Defaults to false. */
	readonly isDST?: boolean;
	/** Altitude of the sun at "sunset", in degrees. Defaults to -0.833. */
	readonly altitude?: number;
}

export interface SunriseSunsetResult {
	/** Local-time hour of sunrise (0..24). Decimal — multiply fractional part by 60 for minutes. */
	readonly sunriseHours: number;
	/** Local-time hour of sunset (0..24). */
	readonly sunsetHours: number;
	/** True when the sun never rises above the target altitude on this day. */
	readonly sunAlwaysDown: boolean;
	/** True when the sun never sets below the target altitude on this day. */
	readonly sunAlwaysUp: boolean;
}

const INV360 = 1 / 360;
const RADEG = 180 / Math.PI;
const DEGRAD = Math.PI / 180;
const UPPER_LIMB = true;

const sind = (n: number) => Math.sin(n * DEGRAD);
const cosd = (n: number) => Math.cos(n * DEGRAD);
const acosd = (n: number) => RADEG * Math.acos(n);
const atan2d = (y: number, x: number) => RADEG * Math.atan2(y, x);

function revolution(angle: number): number {
	return angle - 360 * Math.floor(angle * INV360);
}

function rev180(x: number): number {
	return x - 360 * Math.floor(x * INV360 + 0.5);
}

/** JDN of 1999-12-31 Gregorian, i.e. "Jan 0.0, 2000 Gregorian". */
const JDN_JAN0_2000 = 2451544;

function gmst0(d: number): number {
	return revolution(180 + 356.047 + 282.9404 + (0.9856002585 + 4.70935e-5) * d);
}

function sunpos(d: number): { r: number; lon: number } {
	const M = revolution(356.047 + 0.9856002585 * d);
	const w = 282.9404 + 4.70935e-5 * d;
	const e = 0.016709 - 1.151e-9 * d;
	const E = M + e * RADEG * sind(M) * (1 + e * cosd(M));
	const x = cosd(E) - e;
	const y = Math.sqrt(1 - e * e) * sind(E);
	const r = Math.sqrt(x * x + y * y);
	let lon = atan2d(y, x) + w;
	if (lon >= 360) lon -= 360;
	return { r, lon };
}

function sunRaDec(d: number): { ra: number; dec: number; r: number } {
	const { r, lon } = sunpos(d);
	let x = r * cosd(lon);
	let y = r * sind(lon);
	const obl = 23.4393 - 3.563e-7 * d;
	const z = y * sind(obl);
	y *= cosd(obl);
	const ra = atan2d(y, x);
	const dec = atan2d(z, Math.sqrt(x * x + y * y));
	return { ra, dec, r };
}

export function getSunriseSunset(
	date: CalendarDate,
	opts: SunriseSunsetOptions,
): SunriseSunsetResult {
	const { longitude, latitude } = opts;
	const isDST = opts.isDST ?? false;
	let altitude = opts.altitude ?? SunAltitude.DEFAULT;
	const tz = opts.tzOffsetHours + (isDST ? 1 : 0);

	const jdn = _internal.gregorianYmdToJdn(date.year, date.month, date.day);
	const d = (jdn - JDN_JAN0_2000) + 0.5 - longitude / 360;

	const sidtime = revolution(gmst0(d) + 180 + longitude);
	const { ra, dec, r } = sunRaDec(d);
	const tsouth = 12 - rev180(sidtime - ra) / 15;
	const sradius = 0.2666 / r;
	if (UPPER_LIMB) altitude -= sradius;

	const cost = (sind(altitude) - sind(latitude) * sind(dec))
		/ (cosd(latitude) * cosd(dec));

	let t: number;
	let sunAlwaysDown = false;
	let sunAlwaysUp = false;
	if (cost >= 1) {
		t = 0;
		sunAlwaysDown = true;
	} else if (cost <= -1) {
		t = 12;
		sunAlwaysUp = true;
	} else {
		t = acosd(cost) / 15;
	}

	let sunriseHours = tsouth - t + tz;
	let sunsetHours = tsouth + t + tz;
	sunriseHours = normHours(sunriseHours);
	sunsetHours = normHours(sunsetHours);

	return { sunriseHours, sunsetHours, sunAlwaysDown, sunAlwaysUp };
}

function normHours(h: number): number {
	if (h > 24) return h - 24;
	if (h < 0) return h + 24;
	return h;
}

/** Format a decimal-hours value as `HH:MM` (24-hour clock, zero-padded). */
export function formatClock(hours: number): string {
	const h = Math.floor(hours);
	const m = Math.floor((hours - h) * 60);
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
