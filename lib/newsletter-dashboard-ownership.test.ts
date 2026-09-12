import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("Newsletter summary follows stored company ownership and denies access before counts", async () => {
  let allowed = true;
  let queries = 0;
  const series = [{ workspaceId: "a", createdByWorkspaceId: "b", status: "ACTIVE" }, { workspaceId: "b", createdByWorkspaceId: "a", status: "ACTIVE" }];
  const editions = ["a", "b"].flatMap(workspaceId => ["NEEDS_REVIEW", "SCHEDULED", "SENT"].map(status => ({ series: { workspaceId }, createdByWorkspaceId: workspaceId === "a" ? "b" : "a", status })));
  const exports: { default?: () => Promise<{ props: { summary: { props: { items: { value: number }[] } } } }> } = {};
  const modules: Record<string, unknown> = {
    "react/jsx-runtime": { jsx: (type: unknown, props: unknown) => ({ type, props }) },
    "next/navigation": { redirect: (url: string) => { assert.equal(url, "/admin"); throw new Error("redirect"); } },
    "./components/NewsletterDashboard": { default: "Dashboard" }, "@/app/admin/components/AdminSummaryCards": { default: "Summary" },
    "@/lib/newsletters/api": { requireNewsletterAdministrator: async () => allowed ? { workspaceId: "a" } : null },
    "@/lib/blog-ownership": { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/prisma": { prisma: {
      newsletterSeries: { count: async ({ where }: { where: { AND: { workspaceId: string }[]; status: string } }) => { queries++; return series.filter(row => row.workspaceId === where.AND[0].workspaceId && row.status === where.status).length; } },
      newsletterEdition: { count: async ({ where }: { where: { series: { workspaceId: string }; status: string | { in: string[] } } }) => { queries++; return editions.filter(row => row.series.workspaceId === where.series.workspaceId && (typeof where.status === "string" ? row.status === where.status : where.status.in.includes(row.status))).length; } },
    } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("../app/admin/newsletter-studio/page.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  const page = await exports.default!();
  assert.deepEqual(Array.from(page.props.summary.props.items, item => item.value), [1, 1, 1, 1]);
  assert.equal(queries, 4);
  allowed = false;
  await assert.rejects(exports.default!(), /redirect/);
  assert.equal(queries, 4);
});
