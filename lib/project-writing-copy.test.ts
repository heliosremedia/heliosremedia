import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import { projectWritingFields, type ProjectWritingDraft } from "./project-writing.ts";

const source = readFileSync(new URL("./project-writing-copy.ts", import.meta.url), "utf8");
const exports: { formatAllProjectWriting?: (draft: ProjectWritingDraft) => string } = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: () => ({ projectWritingFields }) });

test("Copy All preserves every edited field in labeled order without changing the draft", () => {
  const draft = Object.fromEntries(projectWritingFields.map(({ key }, index) => [key, `Edited ${index}\nSecond paragraph`])) as ProjectWritingDraft;
  draft.youtubeDescription = "Custom revised description\n\nMy footer";
  draft.videoCaption = "";
  const before = JSON.stringify(draft);
  const result = exports.formatAllProjectWriting!(draft);
  assert.equal(result, projectWritingFields.map(({ key, label }) => `${label}\n${draft[key]}`).join("\n\n"));
  assert.ok(result.includes("YouTube description\nCustom revised description\n\nMy footer"));
  assert.equal(JSON.stringify(draft), before);
});

test("Apply to editor uses the same secondary button treatment as Copy", () => {
  const ui = readFileSync(new URL("../app/admin/projects/ProjectWritingAssistant.tsx", import.meta.url), "utf8");
  assert.match(ui, /className="admin-btn-secondary" aria-label=\{`Copy \$\{label\}`\}/);
  assert.match(ui, /className="admin-btn-secondary" aria-label=\{`Apply \$\{label\}`\}/);
});
