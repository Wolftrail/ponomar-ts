// Project the scraped HTOC corpus (`tests/fixtures/full-<year>.json`)
// down to a day-level view: one record per ISO date with the header
// context, tone, fast text, scripture, troparia, and kontakia.
// Commemorations are omitted (covered by scratch/htoc-saints.json). Each
// scripture / troparion / kontakion carries a `saints` array attributing
// it to the day's commemorations by matching the scripture `note` or
// hymn `title` against `commemoration.text` and `lives[].name`. Empty
// `saints` means the entry is a day-office / feast reading not tied to a
// specific saint, or that no plausible commemoration matched. Troparia
// and kontakia for the same commemoration share a `group` number.
//
// Usage:
//   node --experimental-strip-types scripts/analysis/days.ts

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	YEARS,
	SCRATCH_DIR,
	iterCorpus,
	type Commemoration,
	type Day,
	type Hymn,
	type LivesLink,
	type ScriptureReading,
} from "./corpus.ts";

interface AttributedScripture extends ScriptureReading {
	readonly saints: readonly LivesLink[];
}

interface AttributedHymn extends Hymn {
	readonly saints: readonly LivesLink[];
}

interface DayProjection {
	readonly civil: Day["civil"];
	readonly julian: Day["julian"];
	readonly headerText: string;
	readonly tone: number | null;
	readonly fastText: string | null;
	readonly scripture: readonly AttributedScripture[];
	readonly troparia: readonly AttributedHymn[];
	readonly kontakia: readonly AttributedHymn[];
}

// Titles like "Kontakion, Tone IV" or the HTOC typo "Kontaklon…" are
// kontakia; everything else (explicit "Troparion", bare saint headings,
// "Hymn to the Theotokos", "Exaposteilarion", etc.) goes with troparia.
function isKontakion(title: string): boolean {
	return /\bkonta(k|kl)ion\b/i.test(title);
}

// Anything the note/title matches from these is a pure day-office or
// feast-cycle reading — no per-saint attribution.
const OFFICE_PATTERNS: readonly RegExp[] = [
	/^\(?\d*\s*(st|nd|rd|th)?\s*hour\)?$/i,
	/matins gospel/i,
	/passion gospel/i,
	/royal hours/i,
	/vespers/i,
	/washing of the feet/i,
	/cross procession/i,
	/blessing of waters/i,
	/lesser blessing of water/i,
	/^\(?epistle\)?$/i,
	/^\(?gospel\)?$/i,
	/^liturgys?$/i,
	/sunday (before|after)/i,
	/saturday (before|after)/i,
	/before the (holy )?theophany/i,
	/before the universal elevation/i,
	/after the universal elevation/i,
	/before the nativity/i,
	/after the nativity/i,
	/\b\d+(st|nd|rd|th) sunday\b/i,
	/^circumcision$/i,
	/^the universal exaltation$/i,
	/^robe$/i,
	/^image$/i,
	/^cross$/i,
	/^new year$/i,
	/^earthquake$/i,
	/^meeting$/i,
	/^church$/i,
	/annunciation/i,
];

// Role keywords that identify a saint category rather than a specific
// person. When a note reduces to one of these, we scan the day's
// commemorations for a `text` matching that role.
const ROLE_KEYWORDS: readonly {
	readonly key: RegExp;
	readonly commMatch: RegExp;
}[] = [
	{
		key: /^theotokos$/i,
		commMatch:
			/theotokos|icon of the mother of god|\bmother of god\b|dormition|annunciation|entrance.*theotokos/i,
	},
	{
		key: /^forerunner$/i,
		commMatch: /forerunner|st\.?\s+john the baptist|baptist/i,
	},
	{
		key: /^saints?$/i,
		commMatch:
			/\bst\.?\b|\bsaint\b|\bsaints\b|venerable|hieromartyr|martyr|apostle|equal-to-the-apostles/i,
	},
	{ key: /^apostles?$/i, commMatch: /apostle/i },
	{ key: /^martyrs?$/i, commMatch: /martyr/i },
	{ key: /^great[-\s]?martyr$/i, commMatch: /great-?martyr/i },
	{ key: /^protomartyr$/i, commMatch: /protomartyr/i },
	{ key: /^hieromartyr$/i, commMatch: /hieromartyr/i },
	{ key: /^venerables?$/i, commMatch: /venerable/i },
	{ key: /^prophet$/i, commMatch: /prophet/i },
	{ key: /^fathers$/i, commMatch: /fathers/i },
	{ key: /^ancestors$/i, commMatch: /ancestors|forefathers/i },
	{ key: /^unmercenaries$/i, commMatch: /unmercenar/i },
	{ key: /^passion[-\s]?bearers$/i, commMatch: /passion-?bearer/i },
	{ key: /^departed$/i, commMatch: /departed|reposed|memorial/i },
	{
		key: /^equal[s]?[-\s]?to[-\s]?the[-\s]apostles$/i,
		commMatch: /equal-?to-?the-?apostles/i,
	},
	{ key: /^royal martyrs$/i, commMatch: /royal martyr|tsar|imperial/i },
	{ key: /^40 martyrs$/i, commMatch: /40 martyr|forty martyr/i },
	{
		key: /^angels?$/i,
		commMatch: /angel|archangel|synaxis of the.*angels|michael|gabriel/i,
	},
	{ key: /^hierarchs?$/i, commMatch: /hierarch|three hierarchs/i },
];

function containsCI(hay: string, needle: string): boolean {
	if (!needle) return false;
	return hay.toLowerCase().includes(needle.toLowerCase());
}

// Reduce a raw note to its attribution target(s). Strips positional
// prefixes ("Epistle, " / "Gospel, " / "Vespers, "), matins-gospel
// wrappers, trailing conjunctions, and enclosing parens. Splits on " and "
// when multiple saints share a note (e.g. "Sts. Elizabeth and Barbara").
function targetsFromNote(note: string): string[] {
	let n = note.trim();
	n = n.replace(/^(epistle|gospel|vespers),\s*/i, "");
	const wrap = n.match(/matins gospel\s*\(([^)]+)\)/i);
	if (wrap) n = wrap[1]!;
	n = n.replace(/\s+or$/i, "");
	n = n.replace(/^\(if .+\)$/i, "");
	n = n.replace(/^\((.+)\)$/, "$1").trim();
	if (!n) return [];
	return n
		.split(/\s+and\s+/i)
		.map((p) => p.trim())
		.filter(Boolean);
}

function isOfficeNote(note: string): boolean {
	return OFFICE_PATTERNS.some((r) => r.test(note));
}

// Reduce "St. John", "Venerable Anthony", "Great-martyr Catherine",
// "Hieromartyr Ignatius" to the bare name portion for substring matching
// against a commemoration text.
function extractName(target: string): string | null {
	const m = target.match(
		/^(?:st\.?|sts\.?|saint|saints|venerable|righteous|blessed|holy|hieromartyr|great-?martyr|protomartyr|martyr|apostle|equal-?to-?the-?apostles|prophet|repose of(?: the)?|virgin)\s+(.+)$/i,
	);
	if (m) return m[1]!.trim();
	if (
		/^[A-Z]/.test(target) &&
		!/martyr|apostle|venerable|prophet|forerunner|theotokos|hierarch|departed|fathers/i.test(
			target,
		)
	) {
		return target;
	}
	return null;
}

function attributeScripture(
	entry: ScriptureReading,
	commemorations: readonly Commemoration[],
): LivesLink[] {
	const note = entry.note?.trim() ?? "";
	if (!note || isOfficeNote(note)) return [];

	const found = new Map<string, LivesLink>();
	for (const target of targetsFromNote(note)) {
		if (isOfficeNote(target)) continue;

		const name = extractName(target);
		if (name) {
			for (const comm of commemorations) {
				if (!containsCI(comm.text, name)) continue;
				for (const link of comm.lives) {
					if (containsCI(link.name, name) || containsCI(comm.text, link.name)) {
						found.set(link.href, link);
					}
				}
			}
		}

		for (const role of ROLE_KEYWORDS) {
			if (!role.key.test(target)) continue;
			for (const comm of commemorations) {
				if (!role.commMatch.test(comm.text)) continue;
				for (const link of comm.lives) found.set(link.href, link);
			}
		}
	}
	return [...found.values()];
}

// Titles that are pure hymn-genre markers with no saint / feast name at
// all — safe to skip since no commemoration match is possible.
const PURE_HYMN_TITLE =
	/^(kontakion(,|\s+in|\s*$)|troparion of the sunday|kontakion of the sunday|or this troparion|troparion in the same tone|hymn to the theotokos|glory|both now)/i;

function attributeTroparion(
	hymn: Hymn,
	commemorations: readonly Commemoration[],
): LivesLink[] {
	const title = hymn.title.trim();
	if (!title || PURE_HYMN_TITLE.test(title)) return [];

	const found = new Map<string, LivesLink>();
	const name = extractName(title);
	for (const comm of commemorations) {
		for (const link of comm.lives) {
			if (containsCI(title, link.name)) {
				found.set(link.href, link);
				continue;
			}
			if (name && containsCI(link.name, name)) {
				found.set(link.href, link);
			}
		}
	}
	// Role-keyword fallback so "Kontakion of the Great Martyr" attributes
	// to the day's great-martyr commemoration(s).
	if (found.size === 0) {
		const roleTarget = title
			.replace(/^(troparion|kontakion|hymn)\s+(?:of|for|to)?\s*(?:the\s+)?/i, "")
			.replace(/[,;].*$/, "")
			.trim();
		for (const role of ROLE_KEYWORDS) {
			if (!role.key.test(roleTarget)) continue;
			for (const comm of commemorations) {
				if (!role.commMatch.test(comm.text)) continue;
				for (const link of comm.lives) found.set(link.href, link);
			}
		}
	}
	return [...found.values()];
}

const days: Record<string, DayProjection> = {};
let scriptureTotal = 0;
let scriptureWithNote = 0;
let scriptureOffice = 0;
let scriptureAttributed = 0;
let troparionTotal = 0;
let troparionAttributed = 0;
let kontakionTotal = 0;
let kontakionAttributed = 0;

for (const { iso, day } of iterCorpus()) {
	const scripture: AttributedScripture[] = day.scripture.map((s) => {
		scriptureTotal++;
		if (s.note?.trim()) scriptureWithNote++;
		if (s.note && isOfficeNote(s.note)) scriptureOffice++;
		const saints = attributeScripture(s, day.commemorations);
		if (saints.length > 0) scriptureAttributed++;
		return { ...s, saints };
	});
	const troparia: AttributedHymn[] = [];
	const kontakia: AttributedHymn[] = [];
	for (const t of day.troparia) {
		const saints = attributeTroparion(t, day.commemorations);
		const entry: AttributedHymn = { ...t, saints };
		if (isKontakion(t.title)) {
			kontakionTotal++;
			if (saints.length > 0) kontakionAttributed++;
			kontakia.push(entry);
		} else {
			troparionTotal++;
			if (saints.length > 0) troparionAttributed++;
			troparia.push(entry);
		}
	}
	days[iso] = {
		civil: day.civil,
		julian: day.julian,
		headerText: day.headerText,
		tone: day.tone,
		fastText: day.fastText,
		scripture,
		troparia,
		kontakia,
	};
}

if (!existsSync(SCRATCH_DIR)) mkdirSync(SCRATCH_DIR, { recursive: true });

const outPath = resolve(SCRATCH_DIR, "days.json");
const payload = {
	source: "tests/fixtures/full-<year>.json",
	years: [...YEARS],
	generatedAt: new Date().toISOString(),
	count: Object.keys(days).length,
	days,
};

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${payload.count} days to scratch/days.json`);
console.log(
	`  scripture: ${scriptureTotal} total, ${scriptureWithNote} with note, ${scriptureOffice} office/positional, ${scriptureAttributed} attributed to saint(s)`,
);
console.log(
	`  troparia : ${troparionTotal} total, ${troparionAttributed} attributed to saint(s)`,
);
console.log(
	`  kontakia : ${kontakionTotal} total, ${kontakionAttributed} attributed to saint(s)`,
);
