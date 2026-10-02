// Optional English renderer for the day's fasting rule. Follows the HTOC
// "<Period>. <Level>" shape as a convenience for consumers who want a
// drop-in English label; most consumers should prefer the structured
// `fasting.level` + `fasting.period` on `LiturgicalDay` and render against
// their own tradition / language.
//
// Note: this encodes the strict Russian typikon (Fasting.xml) and will
// differ from HTOC's published Hellenic-tradition text on days with
// polyeleos/6-stich saints on Wed/Fri. See LIMITATIONS.md.

import type { DayContext } from "./day.ts";
import type { FastingLevel, FastingPeriod, FastingPeriodKind } from "./fasting.ts";
import { getFastingPeriod } from "./fasting.ts";

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

const PERIOD_NAME: Readonly<Record<FastingPeriodKind, string>> = {
	"great-lent": "Great Lent",
	apostles: "Apostles' (Peter & Paul) Fast",
	dormition: "Dormition (Theotokos) Fast",
	nativity: "Nativity (St. Philip's Fast)",
	weekly: "Fast",
};

/** English display name for the fasting period. Returns `null` on days
 *  that are not inside any scheduled fast. */
export function getFastingPeriodName(period: FastingPeriod): string | null {
	if (period.kind === null) return null;
	const base = PERIOD_NAME[period.kind];
	return period.isEve ? `Eve of ${base}` : base;
}

/** Compose an English display string for the day's fast — strict Russian
 *  typikon flavour. Empty on non-fasting days. */
export function renderFastText(ctx: DayContext, level: FastingLevel): string {
	const period = getFastingPeriod(ctx);
	const suffix = LEVEL_SUFFIX[level];
	if (period.kind === null) {
		return suffix === "" ? "" : `Fast. ${suffix}`;
	}
	const name = PERIOD_NAME[period.kind];
	if (period.isEve) return `Eve of ${name}.`;
	if (period.kind === "weekly") {
		return suffix === "" ? "" : `Fast. ${suffix}`;
	}
	return suffix === "" ? "" : `${name}. ${suffix}`;
}
