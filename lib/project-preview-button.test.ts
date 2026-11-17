import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("preview creation uses compact non-wrapping Studio button aligned to 40px inputs", () => {
  const source = readFileSync("app/admin/projects/[projectId]/ProjectPreviewManager.tsx", "utf8");
  assert.match(source, /disabled=\{busy\} onClick=\{create\} type="button" className="admin-btn-primary shrink-0 self-start sm:self-auto">Create link/);
  assert.match(source, /aria-label="Client or purpose \(optional\)"/);
  assert.match(source, /aria-label="Link expiry"/);
  assert.equal((source.match(/className="h-10 /g) || []).length, 2);
  assert.match(source, /sm:items-center lg:w-auto lg:shrink-0/);
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /h-10 min-h-10.*whitespace-nowrap/);
});
