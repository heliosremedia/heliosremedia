import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as policy from "./project-hdph-import.ts";
const api: { hdphPropertyWebsite?: (site: Record<string, unknown>, now?: number) => string | null } = {};
vm.runInNewContext(ts.transpileModule(readFileSync("lib/project-hdph-website.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: api, require: () => policy, Date });
const base = { siteId: 3519344, brandId: 7708, status: "active", hasMarketingKit: true, expiration: "2027-11-12", keyring: ["site-mustpay"] };
const now = Date.parse("2026-11-17");
test("uses exact user-supplied Helios viewer host and validated site ID", () => {
  assert.equal(api.hdphPropertyWebsite!(base, now), "https://heliosrealestatemedia.hd.pics/view/?s=3519344&nohit=1");
  assert.equal(api.hdphPropertyWebsite!({ ...base, siteId: 3494181 }, now), "https://heliosrealestatemedia.hd.pics/view/?s=3494181&nohit=1");
});
test("does not generate public website links for other brands or unavailable sites", () => {
  for (const override of [{ brandId: 999 }, { status: "inactive" }, { status: "complete" }, { hasMarketingKit: false }, { hasMarketingKit: undefined }, { expiration: "2026-01-01" }, { expiration: "bad" }, { keyring: ["site-disablepropertysite"] }, { siteId: "1&admin=true" }]) assert.equal(api.hdphPropertyWebsite!({ ...base, ...override }, now), null);
});
test("mapping uses server validated source and never replaces an existing website", () => {
  const action = readFileSync("app/admin/projects/new/actions.ts", "utf8");
  assert.match(action, /propertyWebsiteUrl = sourceSite.propertyWebsiteUrl/);
  assert.doesNotMatch(action, /formData.get\("propertyWebsiteUrl"\)/);
  const route = readFileSync("app/api/admin/projects/hdph-import/route.ts", "utf8");
  assert.match(route, /!target.details\?\.propertyWebsiteUrl && sourceSite.propertyWebsiteUrl/);
});

test("existing draft control fetches only on click, validates link, and does not save", async () => {
  const component: { default?: (props: unknown) => unknown } = {};
  const slots: unknown[] = []; let cursor = 0, calls = 0;
  const applied: string[] = [];
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  vm.runInNewContext(ts.transpileModule(readFileSync("app/admin/projects/LinkedPropertyWebsite.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports: component, URL,
    require: (name: string) => name === "react/jsx-runtime" ? { jsx, jsxs: jsx } : { useState: (value: unknown) => { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], (next: unknown) => { slots[index] = next; }]; } },
    fetch: async (url: string, options: { method?: string }) => { calls++; assert.match(url, /targetProjectId=project/); assert.equal(options.method, undefined); return { ok: true, json: async () => ({ propertyWebsiteUrl: "https://heliosrealestatemedia.hd.pics/view/?s=3519344&nohit=1" }) }; },
  });
  type Node = { type?: unknown; props?: { children?: unknown; onClick?: () => void; disabled?: boolean } };
  const nodes = (v: unknown): Node[] => Array.isArray(v) ? v.flatMap(nodes) : v && typeof v === "object" ? [v as Node, ...nodes((v as Node).props?.children)] : [];
  const render = (hasValue: boolean) => { cursor = 0; return nodes(component.default!({ projectId: "project", siteId: 3519344, hasValue, onApply: (url: string) => applied.push(url) })); };
  const existing = render(true).find(n => n.type === "button")!;
  assert.equal(calls, 0); assert.equal(existing.props!.disabled, true);
  existing.props!.onClick!(); assert.equal(calls, 0);
  render(false).find(n => n.type === "button")!.props!.onClick!();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls, 1); assert.equal(applied.length, 1);
  const editor = readFileSync("app/admin/projects/[projectId]/ProjectDetailsEditor.tsx", "utf8");
  assert.match(editor, /current.propertyWebsiteUrl.trim\(\) \? current : \{ ...current, propertyWebsiteUrl: url \}/);
});

test("website helper spaces guidance explicitly and does not claim live verification", () => {
  const source = readFileSync("app/admin/projects/LinkedPropertyWebsite.tsx", "utf8");
  assert.match(source, /flex flex-col items-start gap-2/);
  assert.match(source, /HDPhotoHub does not report an eligible property website/);
  assert.doesNotMatch(source, /No live property website is available/);
});
