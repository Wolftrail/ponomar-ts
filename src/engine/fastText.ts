// Compose HTOC's fast-rule display string ("Great Lent. Food with Oil"
// etc.) for any civil year by templating the day's fasting period name
// over the strict-level suffix. The 23 unique strings observed in the
// vendored 2025-2027 window all follow the `"<period>. <level>"` shape
// (or a bare `"Eve of <period>."` on the day before each major fast).
//
// Period boundaries were derived from the vendored corpus:
//   nday ∈ [-48, -1]              → Great Lent
//   nday === 56                   → Eve of Apostles' Fast
//   nday ≥ 57, Julian ≤ 6/28      → Apostles' (Peter & Paul) Fast
//   Julian 7/31                   → Eve of the Dormition Fast
//   Julian 8/1 - 8/14             → Dormition (Theotokos) Fast
//   Julian 11/14                  → Eve of the Nativity Fast
//   Julian 11/15 - 12/24          → Nativity (St. Philip's Fast)
//   otherwise, a fasting day      → bare "Fast" (weekly Wed/Fri, eves)

import type { FastingLevel } from "./fasting.ts";
import type { DayContext } from "./day.ts";

const LEVEL_SUFFIX: Readonly<Record<FastingLevel, string>> = {
	"no-food": "By Monastic Charter - Full abstention from food",
	strict: "By Monastic Charter: Strict Fast (Bread, Vegetables, Fruits)",
	"no-oil": "By Monastic Charter: Food without Oil",
	wine: "By Monastic Charter: Strict Fast (Bread, Vegetables, Fruits)",
	oil: "Food with Oil",
	caviar: "Caviar Allowed",
	fish: "Fish Allowed",
	"meat-excluded": "",
	"no-fast": "",
	custom: "",
};

function periodName(ctx: DayContext): { name: string; isEve: boolean } | null {
	const { nday, julian } = ctx;
	if (nday === -49) return { name: "Eve of Great Lent", isEve: true };
	if (nday >= -48 && nday <= -1) return { name: "Great Lent", isEve: false };
	if (nday === 56) return { name: "Eve of Apostles' (Peter & Paul) Fast", isEve: true };
	if (nday >= 57 && isBeforeJulian(julian.month, julian.day, 6, 29))
		return { name: "Apostles' (Peter & Paul) Fast", isEve: false };
	if (julian.month === 7 && julian.day === 31)
		return { name: "Eve of the Dormition Fast", isEve: true };
	if (julian.month === 8 && julian.day >= 1 && julian.day <= 14)
		return { name: "Dormition (Theotokos) Fast", isEve: false };
	if (julian.month === 11 && julian.day === 14)
		return { name: "Eve of the Nativity Fast", isEve: true };
	if (
		(julian.month === 11 && julian.day >= 15) ||
		(julian.month === 12 && julian.day <= 24)
	) {
		return { name: "Nativity (St. Philip's Fast)", isEve: false };
	}
	return null;
}

function isBeforeJulian(
	mo: number,
	day: number,
	targetMo: number,
	targetDay: number,
): boolean {
	if (mo < targetMo) return true;
	if (mo > targetMo) return false;
	return day < targetDay;
}

/** Render HTOC's fast-rule display string for the given day. Returns
 *  the empty string on non-fasting days (matching HTOC's convention
 *  of leaving the fast line blank). */
export function renderFastText(ctx: DayContext, level: FastingLevel): string {
	const suffix = LEVEL_SUFFIX[level];
	const period = periodName(ctx);
	if (period === null) {
		if (suffix === "") return "";
		return `Fast. ${suffix}`;
	}
	if (period.isEve) return `${period.name}.`;
	if (suffix === "") return "";
	return `${period.name}. ${suffix}`;
}
