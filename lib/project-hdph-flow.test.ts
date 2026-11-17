import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path: string) => readFileSync(path, "utf8");
test("creation uses a details-only selection and regular draft form", () => {
  const form = read("app/admin/projects/new/NewProjectForm.tsx");
  assert.match(form, /HDPhotoHubImport currentDetails=/);
  assert.match(form, /name="hdphSiteId"/);
  assert.match(form, /setTitle\(property.title.slice/);
  assert.match(form, /propertyAddress: replaceDetails \|\| !current.propertyAddress.trim\(\) \? property.propertyAddress : current.propertyAddress/);
  const ui = read("app/admin/projects/HDPhotoHubImport.tsx");
  assert.match(ui, /onSelectProperty \? <div[\s\S]*?Use property details<\/button>/);
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

test("new project follows import, location, writing, identity order without jumping focus", () => {
  const form = read("app/admin/projects/new/NewProjectForm.tsx");
  const positions = ["<HDPhotoHubImport", 'title="Location Details"', "<ProjectWritingAssistant", "                Project identity"].map(value => form.indexOf(value));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.doesNotMatch(form, /autoFocus/);
  assert.match(form, /useState\(false\)/);
  assert.match(form, /if \(replaceDetails \|\| !title.trim\(\)\)/);
  assert.match(form, /state: stateEdited \? fields.state : ""/);
});

test("property selection replaces untouched state preset, preserves manual state, and honors explicit replacement", async () => {
  const { default: vm } = await import("node:vm");
  const { default: ts } = await import("typescript");
  const source = read("app/admin/projects/new/NewProjectForm.tsx");
  const slots: unknown[] = []; let cursor = 0;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const component: { default?: () => unknown } = {};
  const picker = () => null;
  const modules: Record<string, unknown> = {
    react: { useId: () => "handoff", useActionState: () => [{ error: null }, () => {}], useState: (initial: unknown) => {
      const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], (value: unknown) => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }];
    } },
    "react-dom": { useFormStatus: () => ({ pending: false }) },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "../HDPhotoHubImport": { default: picker },
    "../ProjectWritingAssistant": { default: () => null },
    "next/link": { default: () => null },
    "@/app/admin/components/AdminCardHeading": { default: () => null },
    "@/lib/project-types": { PROJECT_TYPES: [] },
    "./actions": { createProject: () => {} },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports: component, require: (name: string) => modules[name] });
  type Node = { type?: unknown; props?: { name?: string; type?: string; value?: string; children?: unknown; onChange?: (event: unknown) => void; onSelectProperty?: (property: unknown, replace?: boolean) => void } };
  const nodes = (value: unknown): Node[] => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === "object" ? [value as Node, ...nodes((value as Node).props?.children)] : [];
  const render = () => { cursor = 0; return nodes(component.default!()); };
  const select = (state: string, replace = false) => render().find(node => node.type === picker)!.props!.onSelectProperty!({ siteId: 1, title: "Home", city: "City", state, locationLabel: "City", propertyAddress: "1 Main" }, replace);
  const stateField = () => render().find(node => node.props?.name === "state")!.props!;
  assert.equal(stateField().value, "Colorado");
  select("Wyoming"); assert.equal(stateField().value, "Wyoming");
  stateField().onChange!({ target: { value: "Utah" } });
  select("Arizona"); assert.equal(stateField().value, "Utah");
  select("Arizona", true); assert.equal(stateField().value, "Arizona");
});

test("HDPH source belongs only to ProjectDetails and matches migration", () => {
  const schema = read("prisma/schema.prisma");
  assert.equal((schema.match(/hdphSiteId Int\?/g) || []).length, 1);
  const details = schema.slice(schema.indexOf("model ProjectDetails {"), schema.indexOf("model Media {"));
  assert.match(details, /hdphSiteId Int\?/);
  assert.equal(read("prisma/migrations/20261117020000_project_hdph_source/migration.sql").trim(), 'ALTER TABLE "ProjectDetails" ADD COLUMN "hdphSiteId" INTEGER;');
});

test("new project avoids duplicate intro and keeps optional manual/import guidance", () => {
  assert.doesNotMatch(read("app/admin/projects/new/page.tsx"), /Start with the essential project information/);
  assert.match(read("app/admin/projects/new/NewProjectForm.tsx"), /Start with an optional HDPhotoHub property, or enter everything manually below/);
});
