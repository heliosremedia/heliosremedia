import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeWorkspaceHostname, tenantContextEnabled } from "./workspace-context-core.ts";

test("workspace hostnames normalize consistently without retaining ports or paths", () => {
  assert.equal(normalizeWorkspaceHostname("WWW.HeliosRealEstateMedia.com:443"), "www.heliosrealestatemedia.com");
  assert.equal(normalizeWorkspaceHostname("https://Studio.Example.com/admin"), "studio.example.com");
  assert.equal(normalizeWorkspaceHostname("tenant.example.com."), "tenant.example.com");
});

test("invalid or absent workspace hostnames fail closed", () => {
  assert.equal(normalizeWorkspaceHostname(null), null);
  assert.equal(normalizeWorkspaceHostname(" "), null);
  assert.equal(normalizeWorkspaceHostname("not a host"), null);
  assert.equal(normalizeWorkspaceHostname("attacker@tenant.example.com"), null);
  assert.equal(normalizeWorkspaceHostname("tenant.example.com/other"), null);
});

test("tenant context is opt-in and requires an exact true value", () => {
  assert.equal(tenantContextEnabled(undefined), false);
  assert.equal(tenantContextEnabled("false"), false);
  assert.equal(tenantContextEnabled(" TRUE "), true);
});

test("tenant foundation is additive, backfilled, and fail-closed behind its flag", () => {
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../prisma/migrations/20260910050000_workspace_tenant_foundation/migration.sql", import.meta.url), "utf8");
  const resolver = readFileSync(new URL("./public-workspace.ts", import.meta.url), "utf8");

  assert.match(schema, /model WorkspaceMembership[\s\S]*@@unique\(\[workspaceId, userId\]\)/);
  assert.match(schema, /model WorkspaceDomain[\s\S]*hostname\s+String\s+@unique/);
  assert.match(migration, /INSERT INTO "WorkspaceMembership"/);
  assert.match(migration, /ON CONFLICT \("workspaceId", "userId"\) DO NOTHING/);
  assert.match(migration, /WHERE "primary" = true/);
  assert.match(resolver, /if \(!tenantContextEnabled\(\)\) return getLegacyPublicWorkspaceId\(\)/);
  assert.match(resolver, /purpose === "PUBLIC_SITE" && domain\.status === "ACTIVE"/);
  assert.match(resolver, /throw new Error\("No active public workspace is configured for this host\."\)/);
});
