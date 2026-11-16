import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseProjectWritingDraft, projectWritingFields, isProjectWritingApplication, projectWritingInstructions, projectWritingBrandFooter } from "./project-writing.ts";

test("writing suggestions require all fields and respect editor limits", () => {
  const draft = Object.fromEntries(projectWritingFields.map(({ key }) => [key, "Reviewed property copy"]));
  assert.equal(parseProjectWritingDraft(draft).title, "Reviewed property copy");
  assert.throws(() => parseProjectWritingDraft({ ...draft, title: "a".repeat(121) }));
  assert.throws(() => parseProjectWritingDraft({ ...draft, youtubeTags: null }));
  assert.throws(() => parseProjectWritingDraft({ ...draft, shortDescription: " " }));
});

test("application events cannot route project copy to video or YouTube copy into the editor", () => {
  assert.equal(isProjectWritingApplication({ field: "title", value: "Title", target: "project", projectId: "one" }), true);
  assert.equal(isProjectWritingApplication({ field: "title", value: "Title", target: "hosted-video" }), false);
  assert.equal(isProjectWritingApplication({ field: "videoTitle", value: "Title", target: "upload-video" }), true);
  assert.equal(isProjectWritingApplication({ field: "youtubeTitle", value: "Title", target: "project" }), false);
  assert.equal(isProjectWritingApplication({ field: "title", value: "x".repeat(121), target: "project" }), false);
});

test("editor mounts reviewed AI and SEO with one four-step navigation", () => {
  const page = readFileSync(new URL("../app/admin/projects/[projectId]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /<ProjectWritingAssistant projectId=/);
  assert.match(page, /seoEditor=\{<ProjectSeoEditor/);
  assert.equal((page.match(/step: "0[1-4]"/g) || []).length, 4);
  assert.doesNotMatch(page, /<ProjectProgressCard/);
  for (const component of ["ProjectDetailsEditor", "ExternalMediaForm", "StreamVideoUploader"]) {
    const source = readFileSync(new URL(`../app/admin/projects/[projectId]/${component}.tsx`, import.meta.url), "utf8");
    assert.match(source, /addEventListener\(PROJECT_WRITING_APPLY_EVENT/);
    assert.match(source, /application.projectId !== projectId/);
    assert.match(source, /removeEventListener\(PROJECT_WRITING_APPLY_EVENT/);
  }
});

test("new draft hands off source and suggestions only in tab-local storage", () => {
  const helper = readFileSync(new URL("../app/admin/projects/ProjectWritingAssistant.tsx", import.meta.url), "utf8");
  const action = readFileSync(new URL("../app/admin/projects/new/actions.ts", import.meta.url), "utf8");
  const form = readFileSync(new URL("../app/admin/projects/new/NewProjectForm.tsx", import.meta.url), "utf8");
  assert.match(form, /handoffKey=\{writingHandoff\}/);
  assert.match(action, /encodeURIComponent\(handoff\)/);
  assert.match(helper, /sessionStorage\.removeItem\(storageKey\)/);
  assert.match(helper, /url\.searchParams\.delete\("writingHandoff"\)/);
  assert.match(helper, /setDraft\(parseProjectWritingDraft\(payload\.draft\)\)/);
  assert.match(helper, /Nothing has been applied automatically/);
  assert.doesNotMatch(action, /sessionStorage|agentDescription|payload\.source/);
});


test("sample-aligned copy has distinct portfolio, video and YouTube guidance", () => {
  assert.equal(projectWritingFields.find(field => field.key === "title")?.label, "Portfolio title");
  assert.equal(projectWritingFields.find(field => field.key === "shortDescription")?.label, "Portfolio description");
  for (const instruction of ["Property Tour | ", "expanded multi-paragraph description", "blank lines", "independently copyable", "Project narrative", "complementary caption"]) {
    assert.ok(projectWritingInstructions.includes(instruction), instruction);
  }
  assert.ok(projectWritingInstructions.includes(projectWritingBrandFooter));
  assert.match(projectWritingBrandFooter, /Light\. Clarity\. Vision\./);
});

test("writing guidance preserves source facts and private-address guardrail", () => {
  assert.match(projectWritingInstructions, /Use only explicitly supplied property facts/);
  assert.match(projectWritingInstructions, /Do not include street addresses, contact details or access codes/);
  assert.match(projectWritingInstructions, /Never invent previously featured properties/);
  assert.match(projectWritingInstructions, /Preserve uncertainty and qualifiers/);
  assert.match(projectWritingInstructions, /Never claim to have seen photos or watched a video/);
  assert.match(projectWritingInstructions, /Do not add a creative recommendation/);
  assert.doesNotMatch(projectWritingInstructions, /31174|Shadow Mountain|Stiles Development/);
});

test("each suggestion retains an independent copy action and review-only application", () => {
  const helper = readFileSync(new URL("../app/admin/projects/ProjectWritingAssistant.tsx", import.meta.url), "utf8");
  assert.match(helper, /projectWritingFields\.map/);
  assert.match(helper, /void copy\(key\)/);
  assert.match(helper, /navigator\.clipboard\.writeText\(draft\[key\]\)/);
  assert.match(helper, /Confirm replacement/);
  assert.match(helper, /YouTube title, description, and tags are copy-only/);
});
