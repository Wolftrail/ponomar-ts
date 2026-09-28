// Phase 8c-ii: PHRASES map + resolver smoke tests.
//
// We check a handful of upstream-known phrase files across each of the four
// scanned roots (CommonPrayers, Text, Header, Command), plus the two nested
// TROPARION / KONTAKION subdirs. Every resolver is exercised end-to-end
// against real directives constructed inline.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PHRASES } from "../src/data/index.ts";
import type {
	BibleDirective,
	CreateDirective,
	ServiceTitle,
} from "../src/data/index.ts";
import {
	getPhrase,
	resolveBibleHeader,
	resolveCommand,
	resolveCreate,
	resolveTitle,
} from "../src/engine/index.ts";

describe("PHRASES map (Phase 8c-ii)", () => {
	it("captures a representative sample from every scanned root", () => {
		const alleluia = PHRASES["CommonPrayers/AlleluiaGlory"];
		assert.ok(alleluia, "CommonPrayers/AlleluiaGlory missing");
		assert.match(alleluia.text, /Alleluia/i);

		const psalm5 = PHRASES["Header/Psalm5"];
		assert.ok(psalm5, "Header/Psalm5 missing");
		assert.equal(psalm5.text, "Psalm 5");

		const bow = PHRASES["Command/Bow"];
		assert.ok(bow, "Command/Bow missing");
		assert.match(bow.text, /Bow/i);

		const ninth = PHRASES["Text/NinthHour"];
		assert.ok(ninth, "Text/NinthHour missing");
		assert.match(ninth.text, /Ninth Hour/);
	});

	it("indexes the TROPARION / KONTAKION nested subdirs", () => {
		const fri1t = PHRASES["CommonPrayers/TROPARION/FRI1"];
		assert.ok(fri1t, "TROPARION/FRI1 missing");
		assert.match(fri1t.text, /save Your people/i);
		assert.equal(fri1t.header, "Troparion for Friday (Tone 1)");

		const fri1k = PHRASES["CommonPrayers/KONTAKION/FRI1"];
		assert.ok(fri1k, "KONTAKION/FRI1 missing");
		assert.ok(fri1k.text.length > 10);
	});

	it("has a reasonable phrase count across every root", () => {
		const keys = Object.keys(PHRASES);
		const roots = new Map<string, number>();
		for (const k of keys) {
			const root = k.split("/")[0]!;
			roots.set(root, (roots.get(root) ?? 0) + 1);
		}
		assert.ok((roots.get("CommonPrayers") ?? 0) >= 200);
		assert.ok((roots.get("Text") ?? 0) >= 10);
		assert.ok((roots.get("Header") ?? 0) >= 10);
		assert.ok((roots.get("Command") ?? 0) >= 10);
	});

	it("marks the header field only when present in the source XML", () => {
		let withHeader = 0;
		let withoutHeader = 0;
		for (const p of Object.values(PHRASES)) {
			if (p.header !== undefined) withHeader++;
			else withoutHeader++;
		}
		assert.ok(withHeader > 100);
		assert.ok(withoutHeader > 50);
	});
});

describe("phrase resolvers", () => {
	it("resolveCreate looks up CREATE.what under CommonPrayers/", () => {
		const dir: CreateDirective = {
			kind: "create",
			what: "AlleluiaGlory",
		};
		const p = resolveCreate(dir);
		assert.ok(p);
		assert.match(p.text, /Alleluia/i);
	});

	it("resolveCommand looks up Command/", () => {
		const p = resolveCommand("Bow");
		assert.ok(p);
		assert.match(p.text, /Bow/i);
		assert.equal(resolveCommand("NoSuchCommand"), undefined);
	});

	it("resolveBibleHeader resolves static Verses to Header/", () => {
		const dir: BibleDirective = {
			kind: "bible",
			verses: "Psalm_5",
			header: true,
		};
		const p = resolveBibleHeader(dir);
		assert.ok(p);
		assert.equal(p.text, "Psalm 5");
	});

	it("resolveBibleHeader returns undefined for dynamic BIBLE forms", () => {
		const dyn: BibleDirective = {
			kind: "bible",
			getReading: "Jerem",
			header: true,
		};
		assert.equal(resolveBibleHeader(dyn), undefined);
	});

	it("resolveTitle maps every text-labelled field", () => {
		const t: ServiceTitle = { value: "NinthHour" };
		const r = resolveTitle(t);
		assert.match(r.value ?? "", /Ninth Hour/);
	});

	it("getPhrase returns undefined for unknown keys", () => {
		assert.equal(getPhrase("nope"), undefined);
	});
});
