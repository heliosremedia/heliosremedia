import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("V1.9.1 uses focused studio dashboard language and explicit health states", () => {
  const page = read("app/admin/page.tsx");
  assert.match(page, />Dashboard</);
  assert.doesNotMatch(page, /Admin Command Center|Compact Performance Snapshot|Unified Recent Activity/);
  assert.match(page, /Studio Overview/);
  assert.match(page, /Today & Upcoming/);
  for (const tone of ["green", "yellow", "red", "gray"]) {
    assert.match(page, new RegExp(`"${tone}"`));
  }
  assert.match(page, /Booking/);
  assert.match(page, /Email Analytics/);
  assert.match(page, /Client Sync/);
  assert.match(page, /Public Website/);
  assert.match(page, /Verified/);
});

test("primary metrics are specific, clickable, timeframe-aware, and provider-honest", () => {
  const page = read("app/admin/page.tsx");
  for (const label of [
    "New inquiries",
    "Published projects",
    "Portfolio views",
    "Project drafts",
    "Newsletter sends",
    "Email Studio sends",
    "Confirmed delivered",
    "Content reviews",
  ]) assert.match(page, new RegExp(label));
  assert.match(page, /7, 30, 90/);
  assert.match(page, /Awaiting confirmation can include historical sends that have not been reconciled/);
  assert.match(page, /does not determine current platform health/);
  assert.doesNotMatch(page, /providerWarning/);
  assert.doesNotMatch(page, /label="Campaigns"/);
});

test("dashboard preferences and organization controls remain intact", () => {
  const organizer = read("app/admin/components/DashboardOrganizer.tsx");
  const layout = read("lib/dashboard-layout.ts");
  assert.match(organizer, /Organize Dashboard/);
  assert.match(organizer, /Expand All/);
  assert.match(organizer, /Collapse All/);
  assert.match(organizer, /var\(--helios-orange\)/);
  assert.match(organizer, /aria-live="polite"/);
  assert.match(layout, /recent-activity/);
});

test("refinement adds workspace portfolio context without touching frozen surfaces", () => {
  const dashboard = read("lib/dashboard.ts");
  assert.match(dashboard, /featuredExpiresAt/);
  assert.match(dashboard, /portfolioAnalyticsEvent\.count/);
  assert.match(dashboard, /where: \{ workspaceId \}/);
  const changedRelease = read("lib/releases.ts");
  assert.match(changedRelease, /No Homepage Curation, public homepage, Referral Studio, or Social Studio functionality changed/);
});

test("dashboard cards share Helios headings and do not stretch collapsed neighbors", () => {
  const organizer = read("app/admin/components/DashboardOrganizer.tsx");
  assert.match(organizer, /import AdminCardHeading/);
  assert.match(organizer, /<AdminCardHeading inline eyebrow=\{cardEyebrows\[id\]\} title=\{card.title\}/);
  assert.match(organizer, /grid items-start gap-4/);
  assert.doesNotMatch(organizer, /collapsed && card.summary|truncate text-xs text-white\/35/);
});

test("dashboard disclosures keep content mounted and identify their controlled panels", () => {
  const organizer = read("app/admin/components/DashboardOrganizer.tsx");
  assert.match(organizer, /aria-controls=\{contentId\}/);
  assert.match(organizer, /controls=\{contentId\}/);
  assert.match(organizer, /id=\{contentId\} hidden=\{collapsed\}/);
  assert.match(organizer, /<h2>/);
  assert.match(organizer, /\/api\/admin\/dashboard-layout/);
});

test("dashboard heading resets inherited serif for eyebrow and description, preserving serif title", async () => {
  const { createRequire } = await import("node:module");
  const { runInNewContext } = await import("node:vm");
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const modules: Record<string, string> = {
    "@/lib/dashboard-layout": "lib/dashboard-layout.ts",
    "./AdminCardControls": "app/admin/components/AdminCardControls.tsx",
    "./AdminCardHeading": "app/admin/components/AdminCardHeading.tsx",
  };
  function compile(path: string): Record<string, unknown> {
    const compiled = { exports: {} };
    const output = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    runInNewContext(output, { module: compiled, exports: compiled.exports, require: (name: string) => modules[name] ? compile(modules[name]) : require(name) });
    return compiled.exports;
  }
  const Organizer = compile("app/admin/components/DashboardOrganizer.tsx").default;
  const html = renderToStaticMarkup(React.createElement(Organizer, {
    initialPreferences: { rows: [["quick-actions"]], order: ["quick-actions"], collapsed: [] },
    cards: [{ id: "quick-actions", title: "Quick Actions", summary: "Create studio work", content: "Fixture content" }],
  }));
  // Inspect the real rendered title control, not a lookalike fixture component.
  const heading = html.match(/<h2>([\s\S]*?)<\/h2>/)?.[1];
  assert.ok(heading);
  assert.match(heading, /<button[^>]*class="[^"]*\bfont-helios\b/);
  assert.match(heading, /<span[^>]*class="[^"]*\bfont-display\b[^>]*>Quick Actions<\/span>/);
  assert.match(heading, />Workspace<\/span>/);
  assert.match(heading, />Create studio work<\/span>/);
  assert.match(html, /aria-controls="dashboard-quick-actions-content"/);
  assert.match(html, /id="dashboard-quick-actions-content"[^>]*>Fixture content<\/div>/);
  const css = read("app/globals.css");
  assert.match(css, /\.font-helios\s*\{\s*font-family: var\(--font-helios\)/);
  assert.match(css, /\.font-display\s*\{\s*font-family: var\(--font-cormorant\)/);
});
