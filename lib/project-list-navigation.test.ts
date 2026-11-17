import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { buildProjectsUrl } from "./project-list-navigation.ts";

test("status filters and pagination land at results while retaining query state", () => {
  for (const status of ["ALL","DRAFT","PUBLISHED","ARCHIVED"]) {
    const url = new URL(buildProjectsUrl({status,search:"Main & Oak",pageSize:60,page:2}), "https://helios.example");
    assert.equal(url.hash,"#project-results");
    assert.equal(url.searchParams.get("status"),status === "ALL" ? null : status);
    assert.equal(url.searchParams.get("search"),"Main & Oak");
    assert.equal(url.searchParams.get("pageSize"),"60");
    assert.equal(url.searchParams.get("page"),"2");
  }
  assert.equal(buildProjectsUrl({status:"ALL",search:"",pageSize:30}),"/admin/projects#project-results");
});
test("search and page-size forms target the same visible results anchor", () => {
  const page = readFileSync(new URL("../app/admin/projects/page.tsx",import.meta.url),"utf8");
  assert.equal((page.match(/action="\/admin\/projects#project-results"/g)||[]).length,2);
  assert.ok(page.includes('id="project-results"'));
  assert.ok(page.includes("scroll-mt-24"));
});
