import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path: string) => readFileSync(path, "utf8");
test("creation uses a details-only selection and regular draft form", () => {
  const form = read("app/admin/projects/new/NewProjectForm.tsx");
  assert.match(form, /HDPhotoHubImport onSelectProperty=/);
  assert.match(form, /name="hdphSiteId"/);
  assert.match(form, /setTitle\(property.title.slice/);
  assert.match(form, /propertyAddress: property.propertyAddress/);
  const ui = read("app/admin/projects/HDPhotoHubImport.tsx");
  assert.match(ui, /onSelectProperty \? <button[\s\S]*?Use property details<\/button> : <>/);
  assert.match(ui, /if \(!property \|\| !rights \|\| busy\) return/);
});
test("source is persisted only after server workspace validation, without media writes", () => {
  const action = read("app/admin/projects/new/actions.ts");
  assert.ok(action.indexOf("projectHdphReader(session.workspaceId).site(hdphSiteId)") < action.indexOf("prisma.project.create"));
  assert.match(action, /create: \{ propertyAddress: propertyAddress \|\| null, hdphSiteId \}/);
  assert.doesNotMatch(action, /prisma.media|PutObjectCommand/);
});
test("existing draft media owns importer and retains linked source", () => {
  const page = read("app/admin/projects/[projectId]/page.tsx");
  const media = page.indexOf('<ProjectEditorSection id="project-media"');
  assert.ok(page.indexOf("<HDPhotoHubImport", media) > media);
  assert.match(page, /hdphSiteId: true/);
  assert.match(page, /initialSiteId=\{project.details\?\.hdphSiteId\}/);
  const route = read("app/api/admin/projects/hdph-import/route.ts");
  assert.match(route, /if \(!body.targetProjectId\) return/);
  assert.doesNotMatch(route, /prisma.project.upsert|action === "draft"/);
  assert.match(route, /action === "link"/);
  assert.match(route, /workspaceId: session.workspaceId, status: "DRAFT"/);
});
