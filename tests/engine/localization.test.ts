import assert from "node:assert/strict";
import test from "node:test";
import { formatCommemoration, formatTimes, podobenIntro } from "../../src/engine/localization.ts";

test("repeat counts use the last label whose condition holds", async () => {
	assert.equal(await formatTimes("en", 2), "<i>Twice</i>");
	assert.equal(await formatTimes("en", 3), "<i>Thrice</i>");
	assert.equal(await formatTimes("en", 5), "<i>5 times</i>");
	assert.equal(await formatTimes("en", 1), "");
	assert.equal(await formatTimes("fr", 3), "<i>3 fois</i>");
	assert.equal(await formatTimes("cu/ru", 22), "<i>22 раза̑</i>");
	assert.equal(await formatTimes("cu/ru", 25), "<i>25 ра̑зъ</i>");
});

test("the text before the number in a repeat count is trimmed, as upstream", async () => {
	assert.equal(await formatTimes("el", 5), "ἐκ5");
});

test("a melody introduction is found by tone and case", async () => {
	assert.equal(await podobenIntro("en", "2", "1"), "With what wreaths of praise");
	assert.equal(await podobenIntro("en", "2", "99"), undefined);
});

test("commemoration names take the format of their rank", async () => {
	assert.equal(await formatCommemoration("en", 1, "Pascha"), "Pascha");
	assert.equal(await formatCommemoration("en", -2, "Pascha"), "Pascha");
	assert.equal(await formatCommemoration("en", 8, "Pascha"), await formatCommemoration("en", 6, "Pascha"));
	assert.match(await formatCommemoration("en", 3, "Pascha"), /<I>Pascha<\/I>/);
	assert.notEqual(await formatCommemoration("en", 5, "Pascha"), await formatCommemoration("en", 4, "Pascha"));
});
