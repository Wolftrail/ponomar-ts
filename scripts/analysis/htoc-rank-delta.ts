import { getLiturgicalDay } from "../../src/engine/index.ts";

const dates = [
	"2025-01-18",
	"2025-01-06",
	"2025-04-19",
	"2025-08-29",
	"2025-09-08",
	"2025-09-30",
	"2025-11-03",
	"2025-12-07",
];
console.log("date       | ponoDR | htocDR | delta");
for (const iso of dates) {
	const parts = iso.split("-").map(Number);
	const day = getLiturgicalDay({
		year: parts[0]!,
		month: parts[1]!,
		day: parts[2]!,
	});
	console.log(
		iso,
		"|   ",
		day.dRank,
		"  |   ",
		day.htocDRank,
		"  |",
		day.htocDRank - day.dRank,
	);
}

let bumped = 0;
let bumpedHi = 0;
let bumpedHi4 = 0;
let total = 0;
for (let y = 2025; y <= 2027; y++) {
	for (let m = 1; m <= 12; m++) {
		const dim = new Date(y, m, 0).getDate();
		for (let d = 1; d <= dim; d++) {
			const day = getLiturgicalDay({ year: y, month: m, day: d });
			total++;
			if (day.htocDRank > day.dRank) bumped++;
			if (day.htocDRank >= 4 && day.dRank < 4) bumpedHi++;
			if (day.htocDRank === 4 && day.dRank < 4) bumpedHi4++;
		}
	}
}
console.log(
	`\nover ${total} days: htocDR>ponoDR on ${bumped}; htocDR>=4 & ponoDR<4 on ${bumpedHi} (of those, htocDR===4 on ${bumpedHi4})`,
);
