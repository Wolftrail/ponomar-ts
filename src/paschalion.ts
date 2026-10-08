// Ported from Ponomar/Paschalion.java (typiconman/ponomar).

export interface JulianDate {
	readonly year: number;
	readonly month: number;
	readonly day: number;
}

export function getPascha(year: number): JulianDate {
	if (!Number.isInteger(year) || year < 33) {
		throw new RangeError("year must be an integer greater than or equal to 33");
	}

	const a = year % 4;
	const b = year % 7;
	const c = year % 19;
	const d = (19 * c + 15) % 30;
	const e = (2 * a + 4 * b - d + 34) % 7;
	const ordinal = d + e + 114;

	return {
		year,
		month: Math.floor(ordinal / 31),
		day: (ordinal % 31) + 1,
	};
}
