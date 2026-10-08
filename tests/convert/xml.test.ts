import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { childElements, decodeXml, parseXml, textContent, XmlError } from "../../scripts/convert/xml.ts";

test("parses elements, attributes and text", () => {
	const root = parseXml('<?xml version="1.0"?><A x="1" y=\'two\'><B/><C>hi <D/>there</C></A>');
	assert.equal(root.name, "A");
	assert.deepEqual(root.attributes, { x: "1", y: "two" });
	assert.deepEqual(childElements(root).map((e) => e.name), ["B", "C"]);
	assert.equal(textContent(childElements(root, "C")[0]!), "hi there");
});

test("decodes entities and normalizes attribute whitespace", () => {
	const root = parseXml('<A v="a&amp;&amp;b &lt; c&#33;&#x41;" w="line1\n\tline2">&quot;x&apos;</A>');
	assert.equal(root.attributes["v"], "a&&b < c!A");
	assert.equal(root.attributes["w"], "line1  line2");
	assert.equal(textContent(root), "\"x'");
});

test("skips comments, processing instructions and DOCTYPE; keeps CDATA", () => {
	const root = parseXml("<!DOCTYPE A [<!ELEMENT A ANY>]>\n<!-- c --><A><!-- x --><![CDATA[<raw>&]]><?pi data?></A>");
	assert.equal(textContent(root), "<raw>&");
});

test("normalizes line endings and tolerates a BOM", () => {
	assert.equal(textContent(parseXml("<A>a\r\nb\rc</A>")), "a\nb\nc");
	assert.equal(decodeXml(new Uint8Array([0xef, 0xbb, 0xbf, 0x3c, 0x41, 0x2f, 0x3e])), "<A/>");
	assert.equal(decodeXml(new Uint8Array([0xff, 0xfe, 0x3c, 0x00, 0x41, 0x00, 0x2f, 0x00, 0x3e, 0x00])), "<A/>");
});

test("reports malformed input with a position", () => {
	for (const bad of ["<A>", "<A></B>", "<A b></A>", "<A b=1/>", "<A>&nope;</A>", "<A/><B/>", "text", "<A><!-- open</A>"]) {
		assert.throws(() => parseXml(bad), XmlError, bad);
	}
	assert.throws(() => parseXml("<A>\n</B>"), /line 2/);
});

test("lenient mode accepts and reports mismatched closing tags", () => {
	const warnings: string[] = [];
	const root = parseXml("<A><B></C></A>", { lenient: true, warn: (m) => warnings.push(m) });
	assert.equal(childElements(root).length, 1);
	assert.equal(warnings.length, 1);
});

const languages = fileURLToPath(new URL("../../vendor/ponomar/Ponomar/languages/", import.meta.url));

test("parses every vendored XML file strictly", () => {
	const failures: string[] = [];
	let count = 0;
	const walk = (dir: string): void => {
		for (const name of readdirSync(dir)) {
			const path = join(dir, name);
			if (statSync(path).isDirectory()) {
				walk(path);
			} else if (name.endsWith(".xml")) {
				count++;
				try {
					parseXml(decodeXml(readFileSync(path)));
				} catch (error) {
					failures.push(`${path}: ${(error as Error).message}`);
				}
			}
		}
	};
	walk(languages);
	assert.ok(count > 35000, `expected the full corpus, found ${count} files`);
	assert.deepEqual(failures, []);
});
