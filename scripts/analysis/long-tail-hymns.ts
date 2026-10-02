// Enumerate occurrences of the long-tail hymn patterns to design a new
// classification axis for moveable-Sunday-near-feast hymns.
import { DAY_FACTS_BY_ISO } from "../../src/engine/dayFacts.ts";
import { computeDayContext } from "../../src/engine/day.ts";

const TARGETS = [
	"Sunday Before the Nativity of the Savior",
	"Righteous David, Joseph and James",
	"St. John of Shanghai and San Francisco",
	"Holy Fathers of the first six Ecumenical Councils",
	"Sunday of the Holy Fathers of the 7th Ecumenical Council",
	"Sunday of the Holy Forefathers",
	"Rejoice O Bethlehem", // kontakion of Sunday Before Nativity
	"You did not worship the graven image", // kontakion of Forefathers
	"preaching of the apostles and the dogmas of the fathers", // kontakion 6 EC
	"Thy heart hath gone out to all who entreat thee", // kontakion St John SF
];

for (const target of TARGETS) {
	console.log(`\n=== ${target} ===`);
	for (const [iso, facts] of DAY_FACTS_BY_ISO) {
		const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
		const ctx = computeDayContext({ year: y, month: m, day: d });
		for (const h of [...facts.troparia, ...facts.kontakia]) {
			if (h.title.includes(target) || h.text.includes(target)) {
				const jk = `${String(ctx.julian.month).padStart(2, "0")}-${String(ctx.julian.day).padStart(2, "0")}`;
				console.log(`  ${iso}  dow=${ctx.dow}  nday=${ctx.nday}  julianKey=${jk}  gregKey=${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}  "${h.title.slice(0, 60)}"`);
				break;
			}
		}
	}
}
