import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20260803120000_add_project_agent_selection/migration.sql", "utf8");
const editor = readFileSync("app/admin/projects/[projectId]/ProjectDetailsEditor.tsx", "utf8");
const route = readFileSync("app/api/admin/projects/[projectId]/details/route.ts", "utf8");
const portfolio = readFileSync("app/portfolio/[slug]/page.tsx", "utf8");

test("project agents use ordered snapshots and optional stable client identity", () => {
  assert.match(schema, /model ProjectAgent[\s\S]*clientId String\?[\s\S]*displayNameSnapshot String[\s\S]*brokerageSnapshot String\?[\s\S]*displayOrder Int/);
  assert.match(migration, /Legacy ProjectDetails credits remain untouched and are never auto-matched/);
  assert.doesNotMatch(migration, /INSERT INTO "ProjectAgent"/);
  assert.match(portfolio, /project\.agents\.length[\s\S]*project\.details\?\.listingAgent/);
});

test("client-assisted selection is accessible, manual, refreshable, and tenant scoped", () => {
  assert.match(editor, /role="combobox"/);
  assert.match(editor, /role="listbox"/);
  assert.match(editor, /Enter agent manually/);
  assert.match(editor, /Refresh from client record/);
  assert.match(editor, /Move \$\{agent\.displayNameSnapshot\} up/);
  assert.match(route, /workspaceId: session\.workspaceId, clientId: \{ in: linkedClientIds \}/);
  assert.match(route, /workspaceId: session\.workspaceId/);
});
