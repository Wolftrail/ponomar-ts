// Tests for getPropers (HTOC-sourced troparia / kontakia).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { COMMEMORATIONS } from "../src/data/index.ts";
import { getPropers } from "../src/engine/propers.ts";

describe("Commemoration.hymns — codegen output (XML-sourced data layer)", () => {
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

describe("getPropers — runtime API (HTOC-sourced)", () => {
	test("Nativity 2026-01-07 yields the HTOC-published Nativity troparion + kontakion", () => {
		const r = getPropers({ year: 2026, month: 1, day: 7 });
		assert.equal(r.context.gregorian.year, 2026);
		const nativityTrop = r.troparia.find((t) => /Thy nativity/i.test(t.text));
		assert.ok(nativityTrop, "expected Nativity troparion in HTOC propers");
		assert.match(nativityTrop.title, /Troparion/);
		const nativityKont = r.kontakia.find((k) => /Today the Virgin/i.test(k.text));
		assert.ok(nativityKont, "expected Nativity kontakion in HTOC propers");
		assert.match(nativityKont.title, /Kontakion/);
	});

	test("an ordinary weekday in the HTOC window returns typed arrays", () => {
		const r = getPropers({ year: 2026, month: 2, day: 5 });
		assert.ok(Array.isArray(r.troparia));
		assert.ok(Array.isArray(r.kontakia));
		assert.ok(r.troparia.length >= 1);
	});

	test("dates outside the HTOC coverage window return empty arrays", () => {
		const r = getPropers({ year: 2020, month: 2, day: 5 });
		assert.deepEqual(r.troparia, []);
		assert.deepEqual(r.kontakia, []);
	});

	test("kind: 'troparion' suppresses kontakia", () => {
		const r = getPropers({ year: 2026, month: 1, day: 7 }, { kind: "troparion" });
		assert.ok(r.troparia.length > 0);
		assert.equal(r.kontakia.length, 0);
	});

	test("kind: 'kontakion' suppresses troparia", () => {
		const r = getPropers({ year: 2026, month: 1, day: 7 }, { kind: "kontakion" });
		assert.equal(r.troparia.length, 0);
		assert.ok(r.kontakia.length > 0);
	});
});

