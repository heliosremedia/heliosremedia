import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editor = readFileSync(
  new URL("../app/admin/newsletter-studio/components/EditionEditor.tsx", import.meta.url),
  "utf8",
);

test("newsletter block identity fields use full-width vertical rows", () => {
  assert.match(editor, /className="space-y-5"><label className="block[^>]*>Internal label/);
  assert.match(editor, /Internal label.*<\/label><label className="block[^>]*>Eyebrow/s);
  assert.match(editor, /Eyebrow.*<\/label><\/div><label className="block[^>]*>Heading/s);
  assert.match(editor, /Heading.*<\/label><label className="block[^>]*>Body copy/s);
  assert.doesNotMatch(editor, /sm:grid-cols-2"><label[^>]*>Internal label/);
});

test("field edits retain the existing newsletter state keys", () => {
  assert.match(editor, /onPatch\(\{ label: e\.target\.value \}\)/);
  assert.match(editor, /onPatch\(\{ eyebrow: e\.target\.value \}\)/);
  assert.match(editor, /onPatch\(\{ heading: e\.target\.value \}\)/);
  assert.match(editor, /onPatch\(\{ body: e\.target\.value \}\)/);
});
