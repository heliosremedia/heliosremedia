import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function luminance(hex: string) {
  const c = hex.match(/[a-f\d]{2}/gi)!.map(v => parseInt(v,16)/255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return c[0]*.2126 + c[1]*.7152 + c[2]*.0722;
}
function contrast(a: string, b: string) { const values=[luminance(a),luminance(b)].sort((x,y)=>y-x); return (values[0]+.05)/(values[1]+.05); }

test("step cards use compact green completion, discreet orange selection and gray hover", () => {
  const nav=read("../app/admin/components/AdminSectionNavigator.tsx"), css=read("../app/globals.css");
  assert.match(nav, /projectEditor\s*\? `admin-project-step/);
  assert.doesNotMatch(nav, /!text-black|✓/);
  assert.match(nav, /Step \{section.step\}/);
  assert.match(nav, /className="admin-project-step-value">\{section.label\}/);
  assert.match(nav, /sr-only">Complete/);
  assert.match(nav, /aria-current=\{active \? "location"/);
  assert.match(css, /\.admin-project-step\.is-complete \{ border-color: rgba\(110, 231, 183, 0.25\); \}/);
  assert.match(css, /\.admin-project-step\.is-complete \.admin-project-step-value \{ color: #6ee7b7; \}/);
  assert.match(css, /\.admin-project-step\[aria-current="location"\] \{ border-color: rgba\(217, 107, 43, 0.65\); \}/);
  assert.match(css, /\.admin-project-step:hover \{ background: #262629; \}/);
  assert.match(css, /\.admin-project-step:focus-visible/);
  assert.match(css, /min-height: 5rem/);
  assert.match(css, /\.admin-project-step-value \{[^}]*color: #d4d4d8/);
  assert.doesNotMatch(css, /\[aria-current="location"\][^}]*[;{]\s*color:/);
  assert.doesNotMatch(css, /\.admin-project-step\.is-complete[^}]*background:/);
  for (const foreground of ["#6ee7b7", "#d4d4d8", "#f5f1ea", "#a1a1aa"]) {
    for (const background of ["#141414", "#262629"]) assert.ok(contrast(foreground, background) >= 4.5);
  }
});

test("collapsed portfolio panels retain Studio eyebrow, serif title, description and toggle", () => {
  const panel=read("../app/admin/projects/ProjectSettingsPanel.tsx");
  assert.match(panel, /<AdminCardHeading inline eyebrow="Portfolio organization" title=\{title\} description=\{description\}/);
  assert.match(panel, /Portfolio organization/);
  const shared=read("../app/admin/components/AdminCardHeading.tsx"), email=read("../app/admin/email-studio/page.tsx");
  assert.match(shared, /text-xs uppercase tracking-\[0.16em\]/);
  assert.match(shared, /text-xl font-light text-white/);
  assert.match(shared, /text-sm text-white\/45/);
  assert.match(email, /<AdminCardHeading eyebrow="Client experience"/);
  assert.match(email, /<AdminCardHeading eyebrow="Client gatherings"/);
  assert.match(panel, /border-white\/10 bg-\[#111\]/);
  assert.doesNotMatch(panel, /sm:px-6|text-2xl|className="eyebrow/);
  assert.match(panel, /\{description\}/);
  assert.match(panel, /group-open:hidden/);
  assert.match(panel, /group-open:inline/);
  assert.doesNotMatch(panel, /<details[^>]*\bopen=/);
  for (const name of ["FeaturedProjectsManager", "PortfolioDiscoverySettingsManager"]) assert.match(read(`../app/admin/projects/${name}.tsx`), /<ProjectSettingsPanel[^>]+description=/);
});


test("optional project tools share Email Studio heading typography on new and existing drafts", () => {
  for (const name of ["HDPhotoHubImport", "ProjectWritingAssistant"]) {
    const source=read(`../app/admin/projects/${name}.tsx`);
    assert.match(source, /import AdminCardHeading/);
    assert.match(source, /<AdminCardHeading inline eyebrow=/);
    assert.match(source, /rounded-2xl p-5 focus-visible/);
    assert.match(source, /bg-\[#111\]/);
  }
});


test("project editor section headings use the same shared typography", () => {
  const source=read("../app/admin/projects/[projectId]/ProjectEditorSection.tsx");
  assert.match(source, /<AdminCardHeading eyebrow=\{eyebrow\} title=\{title\} description=\{summary\}/);
  assert.doesNotMatch(source, /sm:text-3xl|sm:px-6/);
  assert.match(source, /aria-expanded=\{expanded\}/);
});


test("summary spans and Email Studio paragraph headings share explicit effective margins", () => {
  const shared=read("../app/admin/components/AdminCardHeading.tsx");
  assert.match(shared, /const spacing = \{ margin: 0 \}/);
  assert.equal((shared.match(/style=\{spacing\}/g) || []).length, 6);
  assert.doesNotMatch(shared, /mt-2|titleSpacing/);
});


test("HDPhotoHub search is separate from header description with an orange address label", () => {
  const source=read("../app/admin/projects/HDPhotoHubImport.tsx");
  const summary=source.slice(source.indexOf("<summary"), source.indexOf("</summary>"));
  assert.match(summary, /HDPhotoHub stays unchanged/);
  const body=source.slice(source.indexOf("</summary>"));
  assert.doesNotMatch(body, /Manual editing is always available/);
  assert.match(body, /text-\[var\(--helios-orange\)\]">Search Address<\/span><input/);
});


test("writing helper keeps introduction in header and disclosure near Generate", () => {
  const source=read("../app/admin/projects/ProjectWritingAssistant.tsx");
  const summary=source.slice(source.indexOf("<summary"), source.indexOf("</summary>"));
  assert.match(summary, /Paste the agent’s description once/);
  assert.match(summary, /nothing saves or publishes automatically/);
  assert.match(source, /text-\[var\(--helios-orange\)\]">Agent property description/);
  assert.ok(source.indexOf("Generate sends your description to OpenAI") > source.indexOf("<textarea"));
  assert.ok(source.indexOf("Generate sends your description to OpenAI") < source.indexOf("onClick={() => draft ? setReplaceSuggestions"));
});


test("new project Location is a persistent collapsible section before identity", () => {
  const source=read("../app/admin/projects/new/NewProjectForm.tsx");
  const start=source.indexOf('<details className="group/location');
  const end=source.indexOf("</details>", start);
  assert.ok(start >= 0 && end < source.indexOf("Project identity"));
  const section=source.slice(start,end);
  assert.match(section, /group-open\/location:hidden/);
  assert.match(section, /group-open\/location:inline/);
  for (const field of ["propertyAddress", "city", "state", "locationLabel"]) assert.match(section, new RegExp(`name="${field}"`));
  assert.doesNotMatch(section, /\brequired\b|\bdisabled=|<details[^>]*\bopen=/);
});


test("completed project cards show a centered far-right circled green check", () => {
  const nav=read("../app/admin/components/AdminSectionNavigator.tsx"), css=read("../app/globals.css");
  assert.match(nav, /projectEditor && section.complete \? <span className="admin-project-step-check" aria-hidden="true"/);
  assert.match(nav, /admin-project-step-check[^]*?viewBox="0 0 24 24"/);
  assert.match(css, /\.admin-project-step-check \{[^}]*margin-left: auto;[^}]*align-self: center;[^}]*border-radius: 9999px;[^}]*color: #a7f3d0;/);
  assert.ok(contrast("#a7f3d0", "#262629") >= 4.5);
});
