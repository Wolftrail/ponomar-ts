// Tests for Phase 8a getPropers (troparia / kontakia extraction).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { COMMEMORATIONS } from "../src/data/index.ts";
import { getPropers } from "../src/engine/propers.ts";

describe("Commemoration.hymns — codegen output", () => {
	test("Nativity (cId 3174) carries the paschal-cycle Nativity troparion", () => {
		const c = COMMEMORATIONS["3174"];
		assert.ok(c, "expected Nativity commemoration present");
		const trop = c.hymns.find((h) => h.kind === "troparion");
		assert.ok(trop, "expected at least one troparion");
		assert.equal(trop.service, "liturgy");
		assert.equal(trop.type, "1");
		assert.equal(trop.tone, "4");
		assert.match(trop.body, /Thy nativity/);
		const kont = c.hymns.find((h) => h.kind === "kontakion");
		assert.ok(kont, "expected at least one kontakion");
		assert.equal(kont.tone, "3");
		assert.match(kont.body, /Today the Virgin/);
	});

	test("every hymn has kind, service, and body", () => {
		let seen = 0;
		for (const key of Object.keys(COMMEMORATIONS)) {
			const c = COMMEMORATIONS[key];
			if (c === undefined) continue;
			for (const h of c.hymns) {
				seen++;
				assert.ok(h.kind === "troparion" || h.kind === "kontakion");
				assert.equal(typeof h.service, "string");
				assert.equal(typeof h.body, "string");
			}
		}
		assert.ok(seen > 100, `expected many hymns across commemorations, got ${seen}`);
	});
});

describe("getPropers — runtime API", () => {
	test("Nativity 2020 (Dec 25 Julian) yields the Nativity troparion + kontakion", () => {
		// Gregorian Jan 7, 2021 = Julian Dec 25, 2020 = Nativity of Christ
		const r = getPropers({ year: 2021, month: 1, day: 7 });
		assert.equal(r.context.gregorian.year, 2021);
		const nativityTrop = r.troparia.find(
			(t) => t.cId === "3174" && /Thy nativity/.test(t.body),
		);
		assert.ok(nativityTrop, "expected Nativity troparion in refs");
		assert.equal(nativityTrop.source, "menaion");
		assert.equal(nativityTrop.service, "liturgy");
		assert.equal(nativityTrop.tone, "4");
		const nativityKont = r.kontakia.find(
			(k) => k.cId === "3174" && /Today the Virgin/.test(k.body),
		);
		assert.ok(nativityKont, "expected Nativity kontakion in refs");
		assert.equal(nativityKont.tone, "3");
	});

	test("Pascha 2020 does not crash; results are typed arrays", () => {
		// Note: Pascha's canonical hymns live in Service.xml templates
		// upstream, not in lives XML — so the paschal cycle may yield
		// zero hymns here. This test just guards the API surface.
		const r = getPropers({ year: 2020, month: 4, day: 19 });
		assert.equal(r.context.nday, 0);
		assert.ok(Array.isArray(r.troparia));
		assert.ok(Array.isArray(r.kontakia));
	});

	test("service filter narrows to matins-block hymns only", () => {
		const r = getPropers({ year: 2021, month: 1, day: 7 }, { service: "matins" });
		for (const t of r.troparia) assert.equal(t.service, "matins");
		for (const k of r.kontakia) assert.equal(k.service, "matins");
	});

	test("kind filter narrows the returned lists", () => {
		const r = getPropers({ year: 2021, month: 1, day: 7 }, { kind: "troparion" });
		assert.ok(r.troparia.length > 0);
		assert.equal(r.kontakia.length, 0);
	});

	test("propers on an ordinary weekday do not crash and return arrays", () => {
		const r = getPropers({ year: 2020, month: 2, day: 5 });
		assert.ok(Array.isArray(r.troparia));
		assert.ok(Array.isArray(r.kontakia));
	});
});
