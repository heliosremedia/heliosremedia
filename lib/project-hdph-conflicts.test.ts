import { test } from "node:test";
import assert from "node:assert/strict";
import { hdphDetailConflicts } from "./project-hdph-conflicts.ts";
import { readFileSync } from "node:fs";
test("only nonempty differing user values are conflicts", () => {
  assert.deepEqual(hdphDetailConflicts({}, { title: "Home" }), []);
  assert.deepEqual(hdphDetailConflicts({ title: " Home ", state: "" }, { title: "Home", state: "Wyoming" }), []);
  assert.deepEqual(hdphDetailConflicts({ title: "My title", city: "Denver", state: "Utah" }, { title: "Home", city: "Denver", state: "Wyoming" }), ["title", "state"]);
});
test("replacement control is at selection, resets, and is bound to exact values", () => {
  const ui = readFileSync("app/admin/projects/HDPhotoHubImport.tsx", "utf8");
  assert.match(ui, /onSelectProperty \? <div className="space-y-4 pt-4">/);
  assert.match(ui, /!!conflicts.length && <label/);
  assert.match(ui, /replacementChoice === replacementKey/);
  assert.match(ui, /JSON.stringify\(\[property.siteId, currentDetails/);
  assert.match(ui, /onSelectProperty\(property, replaceDetails\); setReplacementChoice\(""\)/);
  const form = readFileSync("app/admin/projects/new/NewProjectForm.tsx", "utf8");
  assert.doesNotMatch(form, /setReplaceDetails|type="checkbox"/);
});
