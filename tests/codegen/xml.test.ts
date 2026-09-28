import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	XmlError,
	elementChildren,
	parseXml,
} from "../../scripts/codegen/xml.ts";

describe("parseXml", () => {
	it("parses a self-closing root", () => {
		const el = parseXml('<FOO Bar="1"/>');
		assert.equal(el.tag, "FOO");
		assert.deepEqual(el.attrs, { Bar: "1" });
		assert.deepEqual(el.children, []);
	});

	it("parses paired tags with attribute-only children", () => {
		const el = parseXml(
			`<DAY><SAINT SId="0" CId="9050" Tone="-1"/></DAY>`,
		);
		assert.equal(el.tag, "DAY");
		const kids = elementChildren(el);
		assert.equal(kids.length, 1);
		const s = kids[0];
		if (s === undefined) throw new Error("no child");
		assert.equal(s.tag, "SAINT");
		assert.deepEqual(s.attrs, { SId: "0", CId: "9050", Tone: "-1" });
	});

	it("decodes character entities in attribute values and text", () => {
		const el = parseXml(
			`<COMMAND Value="nday &gt;= 52 &amp;&amp; dow != 0">a &lt; b</COMMAND>`,
		);
		assert.equal(el.attrs["Value"], "nday >= 52 && dow != 0");
		const t = el.children[0];
		if (t === undefined || t.kind !== "text") throw new Error("expected text");
		assert.equal(t.text, "a < b");
	});

	it("skips comments and processing instructions", () => {
		const el = parseXml(
			`<?xml version="1.0"?>\n<!-- header --><DATA><X/><!-- inner --><Y/></DATA>`,
		);
		const kids = elementChildren(el);
		assert.deepEqual(
			kids.map((k) => k.tag),
			["X", "Y"],
		);
	});

	it("handles single-quoted attribute values", () => {
		const el = parseXml(`<A x='hello'/>`);
		assert.equal(el.attrs["x"], "hello");
	});

	it("throws on mismatched closing tag", () => {
		assert.throws(() => parseXml(`<A><B></C></A>`), XmlError);
	});

	it("throws on unterminated attribute", () => {
		assert.throws(() => parseXml(`<A x="1/>`), XmlError);
	});

	it("parses a real pentecostarion file shape", () => {
		const el = parseXml(
			`<DAY>\n<SAINT SId="124" CId="9900" Cmd="doy &gt;= 6 &amp;&amp; doy &lt;= 12"/>\n<SAINT SId="0" CId="9260" Tone="5"/>\n</DAY>`,
		);
		const kids = elementChildren(el);
		assert.equal(kids.length, 2);
		assert.equal(kids[0]?.attrs["Cmd"], "doy >= 6 && doy <= 12");
		assert.equal(kids[1]?.attrs["Tone"], "5");
	});
});
