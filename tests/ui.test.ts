import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, parseStrengths, initials } from "../lib/ui.ts";

test("slugify normalizes accents, spaces, and case", () => {
  assert.equal(slugify("Maya Okonkwo"), "maya-okonkwo");
  assert.equal(slugify("José  García!!"), "jose-garcia");
  assert.equal(slugify("  --weird__name--  "), "weird-name");
});

test("slugify caps length at 40 chars", () => {
  assert.ok(slugify("a".repeat(100)).length <= 40);
});

test("parseStrengths handles null and bad JSON safely", () => {
  assert.deepEqual(parseStrengths(null), []);
  assert.deepEqual(parseStrengths("not json"), []);
  assert.deepEqual(parseStrengths('{"a":1}'), []); // non-array
  assert.deepEqual(parseStrengths('["Leadership","Strategy"]'), [
    "Leadership",
    "Strategy",
  ]);
});

test("initials derives 1-2 letters", () => {
  assert.equal(initials("Maya Okonkwo"), "MO");
  assert.equal(initials("Cher"), "CH");
  assert.equal(initials("   "), "?");
});
