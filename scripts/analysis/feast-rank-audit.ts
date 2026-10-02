// One-shot: enumerate the Great Feast (rank "6") commemoration misses and
// all matched pairs where engine's normalized glyph != HTOC's glyph.

import type { CalendarDate } from "../../src/core/calendar/pcalendar.ts";
import { getLiturgicalDay } from "../../src/engine/index.ts";
import { unmapRank } from "../../src/engine/saints.ts";
import { compareCommemorations } from "./comparators.ts";
import { iterCorpus } from "./corpus.ts";

function toCal(iso: string): CalendarDate {
	const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
	return { year: y!, month: m!, day: d! };
}

console.log("### Great Feast (rank 6) HTOC-only commemorations ###\n");
for (const { iso, day: day } of iterCorpus()) {
	const cal = toCal(iso);
	const engineDay = getLiturgicalDay(cal);
	const cmp = compareCommemorations(day.commemorations, engineDay.allSaints);
	for (const h of cmp.only) {
		if (h.rank === "6") {
			console.log(`${iso}  HTOC-only [6]  ${h.text}`);
			console.log(`  engine allSaints:`);
			for (const s of engineDay.allSaints) {
				const name = s.name?.nominative ?? s.name?.short ?? "(anon)";
				const rank = s.church?.rank ?? "-";
				console.log(`    cId=${s.cId} rank=${rank}  ${name}`);
			}
			console.log("");
		}
	}
}

console.log("\n### Rank-glyph mismatches (matched pairs) ###\n");
for (const { iso, day: day } of iterCorpus()) {
	const cal = toCal(iso);
	const engineDay = getLiturgicalDay(cal);
	const cmp = compareCommemorations(day.commemorations, engineDay.allSaints);
	for (const m of cmp.matched) {
		if (m.engineRank === undefined) continue;
		const engineGlyph = unmapRank(m.engineRank);
		// `mapRank` deliberately collapses HTOC "1" (simple) and "o"
		// (octoechos / weekday) onto Ponomar 1; the round-trip through
		// `unmapRank` can't tell them apart, so treat them as equivalent.
		const equivalent = engineGlyph === m.rank
			|| (engineGlyph === "1" && m.rank === "o");
		if (!equivalent) {
			console.log(`${iso}  htoc=${m.rank} engine=${m.engineRank}(${engineGlyph})`);
			console.log(`  htoc:   ${m.text.replace(/\s+/g, " ").slice(0, 100)}`);
			console.log(`  engine: ${m.engineName}`);
			console.log("");
		}
	}
}
