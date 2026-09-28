// Tests for Phase 8c-i service template composition.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SERVICE_TEMPLATES } from "../src/data/index.ts";
import { composeService } from "../src/engine/compose.ts";

describe("SERVICE_TEMPLATES — codegen output", () => {
	test("NinthHour template captured with title", () => {
		const t = SERVICE_TEMPLATES["NinthHour"];
		assert.ok(t);
		assert.equal(t.title?.value, "NinthHour");
		assert.equal(t.title?.source, "NinthSource");
		assert.ok(t.directives.length > 20);
	});

	test("UsualBeginning has no title and all directives are create", () => {
		const t = SERVICE_TEMPLATES["UsualBeginning"];
		assert.ok(t);
		assert.equal(t.title, undefined);
		for (const d of t.directives) {
			assert.equal(d.kind, "create");
		}
	});

	test("Kathisma1 opens with three <BIBLE> psalms with TwoStars on Psalm 1", () => {
		const t = SERVICE_TEMPLATES["Kathisma1"];
		assert.ok(t);
		const first = t.directives[0];
		assert.ok(first);
		assert.equal(first.kind, "bible");
		if (first.kind !== "bible") return; // narrow
		assert.equal(first.verses, "Psalm_1");
		assert.equal(first.twoStars, true);
	});

	test("Prime template supports <BIBLE getReading=...> dynamic form", () => {
		const t = SERVICE_TEMPLATES["Prime"];
		assert.ok(t);
		const dynamic = t.directives.find(
			(d) => d.kind === "bible" && d.getReading !== undefined,
		);
		assert.ok(dynamic, "expected at least one dynamic BIBLE directive");
	});
});

describe("composeService — DSL filtering", () => {
	test("NinthHour PS=0 excludes priest-only creates", () => {
		const r = composeService({ year: 2020, month: 6, day: 7 }, "NinthHour", {
			PS: 0,
		});
		for (const d of r.directives) {
			// The template contains directives guarded by `PS != 0`. Ensure
			// none of them survived with PS=0.
			if (d.kind === "create" && d.what === "BlessingPrime") {
				throw new Error("BlessingPrime should not appear with PS=0");
			}
		}
	});

	test("NinthHour PS=1 excludes reader-only creates", () => {
		const r = composeService({ year: 2020, month: 6, day: 7 }, "NinthHour", {
			PS: 1,
		});
		for (const d of r.directives) {
			if (d.kind === "create" && d.what === "JesusPrayer") {
				throw new Error("JesusPrayer should not appear with PS=1");
			}
		}
	});

	test("Normal mode (PFlag2=0) drops LentenTropar/LentenKontak directives", () => {
		const r = composeService({ year: 2020, month: 6, day: 7 }, "NinthHour", {
			PS: 1,
			PFlag2: 0,
		});
		for (const d of r.directives) {
			if (d.kind === "create") {
				assert.ok(
					!d.what.startsWith("LentenTropar9") &&
						!d.what.startsWith("LentenKontak9"),
					`Lenten directive ${d.what} should be gated out on PFlag2=0`,
				);
			}
		}
	});

	test("Lenten mode (PFlag2=1) includes LentenTropar91", () => {
		const r = composeService({ year: 2020, month: 6, day: 7 }, "NinthHour", {
			PS: 1,
			PFlag2: 1,
		});
		const hasLenten = r.directives.some(
			(d) => d.kind === "create" && d.what === "LentenTropar91",
		);
		assert.ok(hasLenten);
	});
});

describe("composeService — <GET> expansion", () => {
	test("PFlag1=0 expands UsualBeginning inline at the top of NinthHour", () => {
		const r = composeService({ year: 2020, month: 6, day: 7 }, "NinthHour", {
			PS: 1,
			PFlag1: 0,
		});
		const first = r.directives[0];
		assert.ok(first);
		// UsualBeginning starts with either BlessedIsOurGod (priest) or
		// ThroughPrayers (reader) — with PS=1 we get BlessedIsOurGod.
		assert.equal(first.kind, "create");
		if (first.kind !== "create") return;
		assert.equal(first.what, "BlessedIsOurGod");
	});

	test("PFlag1=1 skips UsualBeginning, first directive is ComeWorship1", () => {
		const r = composeService({ year: 2020, month: 6, day: 7 }, "NinthHour", {
			PS: 1,
			PFlag1: 1,
		});
		const first = r.directives[0];
		assert.ok(first);
		assert.equal(first.kind, "create");
		if (first.kind !== "create") return;
		assert.equal(first.what, "ComeWorship1");
	});

	test("Unresolvable Var/ include is preserved as a get directive", () => {
		const r = composeService({ year: 2020, month: 6, day: 7 }, "NinthHour", {
			PS: 1,
			PFlag2: 0,
		});
		const varInclude = r.directives.find(
			(d) => d.kind === "get" && d.file.startsWith("Var/"),
		);
		assert.ok(varInclude, "expected Var/ get directive to survive expansion");
	});
});

describe("composeService — shape", () => {
	test("unknown template throws", () => {
		assert.throws(() =>
			composeService({ year: 2020, month: 6, day: 7 }, "NotATemplate"),
		);
	});

	test("context carries the requested Gregorian date", () => {
		const r = composeService({ year: 2020, month: 6, day: 7 }, "PaschalHours");
		assert.equal(r.context.gregorian.year, 2020);
		assert.equal(r.context.gregorian.month, 6);
		assert.equal(r.context.gregorian.day, 7);
		assert.equal(r.template, "PaschalHours");
		assert.ok(r.title?.value);
	});
});
