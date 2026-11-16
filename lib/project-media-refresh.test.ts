import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
const require = createRequire(import.meta.url);
const ts = require("typescript");

test("import completion refreshes only the matching project collection and unregisters cleanly", () => {
  const source = readFileSync(new URL("../app/admin/projects/[projectId]/ProjectMediaManager.tsx", import.meta.url), "utf8");
  const effect = source.match(/useEffect\(\(\) => \{\s*const refreshImportedMedia[\s\S]*?\}, \[projectId, loadMedia\]\);/)?.[0];
  assert.ok(effect);
  let listener: ((event: unknown) => void) | undefined;
  let cleanup: (() => void) | undefined;
  let loads = 0;
  vm.runInNewContext(ts.transpileModule(effect, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, {
    projectId: "project-a", loadMedia: () => { loads++; },
    useEffect: (fn: () => () => void) => { cleanup = fn(); },
    window: {
      addEventListener: (name: string, fn: (event: unknown) => void) => { assert.equal(name, "helios:project-media-updated"); listener = fn; },
      removeEventListener: (name: string, fn: unknown) => { assert.equal(name, "helios:project-media-updated"); assert.equal(fn, listener); listener = undefined; },
    },
  });
  listener!({}); listener!({ detail: { projectId: "other-project" } });
  assert.equal(loads, 0);
  listener!({ detail: { projectId: "project-a" } });
  assert.equal(loads, 1);
  assert.doesNotMatch(effect, /setAssetDraft|setEditingMediaId|location\.reload|router\.refresh/);
  cleanup!(); assert.equal(listener, undefined);
});
