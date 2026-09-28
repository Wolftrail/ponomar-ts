import { strict as assert } from "node:assert";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseCommandsFile } from "../../scripts/codegen/parseCommands.ts";
import { parseDayFile } from "../../scripts/codegen/parseDay.ts";

function tmpXml(name: string, content: string): string {
	const p = join(tmpdir(), `ponomar-ts-codegen-${Date.now()}-${name}`);
	writeFileSync(p, content, "utf8");
	return p;
}

describe("parseDayFile", () => {
	it("extracts saints with all attributes", () => {
		const file = tmpXml(
			"day.xml",
			`<DAY>\n<SAINT SId="0" CId="9050" Tone="-1"/>\n<SAINT SId="124,125" CId="9900" Cmd="doy &gt;= 6 &amp;&amp; doy &lt;= 12" Src="G"/>\n</DAY>`,
		);
		const day = parseDayFile(file);
		assert.equal(day.saints.length, 2);
		const a = day.saints[0];
		if (a === undefined) throw new Error("no saint");
		assert.deepEqual(a.sIds, ["0"]);
		assert.equal(a.cId, "9050");
		assert.equal(a.tone, "-1");
		const b = day.saints[1];
		if (b === undefined) throw new Error("no saint");
		assert.deepEqual(b.sIds, ["124", "125"]);
		assert.equal(b.cmd, "doy >= 6 && doy <= 12");
		assert.equal(b.src, "G");
	});

	it("omits missing optional fields (no undefined values)", () => {
		const file = tmpXml("day.xml", `<DAY><SAINT CId="1"/></DAY>`);
		const day = parseDayFile(file);
		const s = day.saints[0];
		if (s === undefined) throw new Error("no saint");
		assert.equal("cmd" in s, false);
		assert.equal("tone" in s, false);
		assert.equal("src" in s, false);
	});

	it("throws on unparseable Cmd DSL", () => {
		const file = tmpXml("bad.xml", `<DAY><SAINT CId="1" Cmd="nday @@ 5"/></DAY>`);
		assert.throws(() => parseDayFile(file), /invalid DSL in Cmd/);
	});

	it("validates non-literal Tone expressions", () => {
		const file = tmpXml(
			"tone.xml",
			`<DAY><SAINT CId="1" Tone="(ndayP / 7) % 8"/></DAY>`,
		);
		const day = parseDayFile(file);
		assert.equal(day.saints[0]?.tone, "(ndayP / 7) % 8");
	});
});

describe("parseCommandsFile", () => {
	it("collects <COMMAND> entries and decodes entities", () => {
		const file = tmpXml(
			"cmd.xml",
			`<DATA>\n<COMMAND Name="Transfer" Value="nday &gt;= 52" Cmd="GS == 1"/>\n<COMMAND Name="Suppress" Value="doy == 4" Comments="Eve"/>\n</DATA>`,
		);
		const cmds = parseCommandsFile(file);
		assert.equal(cmds.length, 2);
		assert.equal(cmds[0]?.name, "Transfer");
		assert.equal(cmds[0]?.value, "nday >= 52");
		assert.equal(cmds[0]?.cmd, "GS == 1");
		assert.equal(cmds[1]?.comment, "Eve");
	});

	it("throws on invalid DSL", () => {
		const file = tmpXml(
			"bad.xml",
			`<DATA><COMMAND Name="X" Value="nday @@"/></DATA>`,
		);
		assert.throws(() => parseCommandsFile(file), /invalid DSL/);
	});
});
