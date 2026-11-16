import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function luminance(hex: string) {
  const c = hex.match(/[a-f\d]{2}/gi)!.map(v => parseInt(v,16)/255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return c[0]*.2126 + c[1]*.7152 + c[2]*.0722;
}
function contrast(a: string, b: string) { const values=[luminance(a),luminance(b)].sort((x,y)=>y-x); return (values[0]+.05)/(values[1]+.05); }

test("step cards isolate their colors from important generic button rules", () => {
  const nav=read("../app/admin/components/AdminSectionNavigator.tsx"), css=read("../app/globals.css");
  assert.match(nav, /projectEditor\s*\? `admin-project-step/);
  assert.doesNotMatch(nav, /!text-black/);
  assert.match(css, /\.admin-project-step\.is-complete \{ background: var\(--helios-orange\); border-color: var\(--helios-orange\); color: #171515; \}/);
  assert.match(css, /\.admin-project-step:focus-visible/);
  assert.match(css, /\.admin-project-step-label/);
  assert.match(css, /\.admin-project-step-value/);
  assert.ok(contrast("#171515", "#d96b2b") >= 4.5);
  assert.ok(contrast("#f5f1ea", "#141414") >= 4.5);
  assert.ok(contrast("#171515", "#e98045") >= 4.5);
});

test("collapsed portfolio panels retain Studio eyebrow, serif title, description and toggle", () => {
  const panel=read("../app/admin/projects/ProjectSettingsPanel.tsx");
  assert.match(panel, /eyebrow block text-\[var\(--helios-orange\)\]/);
  assert.match(panel, /Portfolio organization/);
  assert.match(panel, /font-display mt-2 block text-2xl font-light text-white/);
  assert.match(panel, /\{description\}/);
  assert.match(panel, /group-open:hidden/);
  assert.match(panel, /group-open:inline/);
  assert.doesNotMatch(panel, /<details[^>]*\bopen=/);
  for (const name of ["FeaturedProjectsManager", "PortfolioDiscoverySettingsManager"]) assert.match(read(`../app/admin/projects/${name}.tsx`), /<ProjectSettingsPanel[^>]+description=/);
});
