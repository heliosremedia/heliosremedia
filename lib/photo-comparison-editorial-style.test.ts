import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("photo comparisons support flexible public editorial style labels", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260903190000_add_photo_comparison_editorial_style/migration.sql");
  const manager = read("app/admin/photo-comparison/PhotoComparisonManager.tsx");
  const route = read("app/api/admin/photo-comparison/route.ts");
  const comparison = read("app/photo-finishes/PhotoFinishComparison.tsx");

  assert.match(schema, /editorialStyle String\?/);
  assert.match(migration, /ADD COLUMN "editorialStyle" TEXT/);
  assert.match(manager, /placeholder="Aura, Fuze, Brut, or a new style"/);
  assert.doesNotMatch(manager, /<select/);
  assert.match(route, /text\.length > 60/);
  assert.match(comparison, /`\$\{editorialStyle\} Editorial Finish`/);
  assert.match(comparison, /editorialStyle \? .* : "Editorial Finish"/);
});
