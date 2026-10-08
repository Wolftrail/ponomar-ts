// Ported from Ponomar/JDate.java (typiconman/ponomar).
// Differences: immutable values; day 0 is rejected (upstream accepts it); errors are RangeError.

export interface JulianDate {
	readonly year: number;
	readonly month: number;
	readonly day: number;
	readonly jdn: number;
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const DAYS_IN_MONTH_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const MONTH_START_DOY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334] as const;

export function isLeapYear(year: number): boolean {
	return year % 4 === 0;
}

export function daysInMonth(year: number, month: number): number {
	const table = isLeapYear(year) ? DAYS_IN_MONTH_LEAP : DAYS_IN_MONTH;
	const value = table[month - 1];
	if (!Number.isInteger(month) || value === undefined) {
		throw new RangeError(`month must be an integer 1..12, got ${month}`);
	}
	return value;
}

export function julianDate(year: number, month: number, day: number): JulianDate {
	if (!Number.isInteger(year)) {
		throw new RangeError(`year must be an integer, got ${year}`);
	}
	if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) {
		throw new RangeError(`day ${day} is out of range for ${year}-${month}`);
	}
	const jdn = ymdToJdn(year, month, day);
	if (jdn < 0) {
		throw new RangeError(`date ${year}-${month}-${day} precedes Julian day 0`);
	}
	return { year, month, day, jdn };
}

export function julianDateFromJdn(jdn: number): JulianDate {
	if (!Number.isInteger(jdn) || jdn < 0) {
		throw new RangeError(`jdn must be a non-negative integer, got ${jdn}`);
	}
	const c = jdn + 32082;
	const d = Math.floor((4 * c + 3) / 1461);
	const e = c - Math.floor((1461 * d) / 4);
	const m = Math.floor((5 * e + 2) / 153);
	return {
		year: d - 4800 + Math.floor(m / 10),
		month: m + 3 - 12 * Math.floor(m / 10),
		day: e - Math.floor((153 * m + 2) / 5) + 1,
		jdn,
	};
}

export function addDays(date: JulianDate, n: number): JulianDate {
	if (!Number.isInteger(n)) {
		throw new RangeError(`n must be an integer, got ${n}`);
	}
	return julianDateFromJdn(date.jdn + n);
}

export function subtractDays(date: JulianDate, n: number): JulianDate {
	return addDays(date, -n);
}

/** Signed day count `later - earlier`, as `JDate.difference(later, earlier)`. */
export function difference(later: JulianDate, earlier: JulianDate): number {
	return later.jdn - earlier.jdn;
}

export function compare(a: JulianDate, b: JulianDate): number {
	return a.jdn - b.jdn;
}

export function equals(a: JulianDate, b: JulianDate): boolean {
	return a.jdn === b.jdn;
}

/** Sunday is 0. */
export function dayOfWeek(date: JulianDate): DayOfWeek {
	return ((date.jdn + 1) % 7) as DayOfWeek;
}

/** Zero-based day of year on a non-leap scale (1 March is 59 even in leap years); 29 February is 366. */
export function dayOfYear(date: JulianDate): number {
	if (date.month === 2 && date.day === 29) {
		return 366;
	}
	return MONTH_START_DOY[date.month - 1]! + date.day - 1;
}

function ymdToJdn(year: number, month: number, day: number): number {
	const a = Math.floor((14 - month) / 12);
	const y = year + 4800 - a;
	const m = month + 12 * a - 3;
	return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
}
