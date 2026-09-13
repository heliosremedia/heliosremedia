import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("homepage mutation and upload routes require editor access and scope every record to the session workspace", () => {
  const projects = read("../app/api/admin/homepage-projects/route.ts");
  const cards = read("../app/api/admin/homepage-work-cards/route.ts");
  const presign = read("../app/api/admin/homepage-work-cards/presign/route.ts");

  for (const route of [projects, cards, presign]) {
    assert.match(route, /getAdminSession/);
    assert.match(route, /\["OWNER", "ADMIN", "EDITOR"\]\.includes\(session\.role\)/);
    assert.match(route, /workspaceId: session\.workspaceId/);
  }
  assert.match(projects, /deleteMany\(\{ where: \{ id, project: \{ workspaceId: session\.workspaceId \} \} \}\)/);
  assert.match(cards, /project: \{ workspaceId: session\.workspaceId, status: "PUBLISHED" \}/);
  assert.match(cards, /deleteMany\(\{ where: \{ id: card\.id, service: \{ workspaceId: session\.workspaceId \} \} \}\)/);
  assert.match(presign, /service: \{ workspaceId: session\.workspaceId \}/);
});

test("homepage reads use the requested workspace and reject a foreign featured-media relationship", () => {
  const publicHome = read("../app/(public)/page.tsx");
  const adminHome = read("../app/admin/homepage/page.tsx");

  assert.match(publicHome, /getSiteSettings\(publicWorkspaceId\)/);
  assert.match(publicHome, /project: \{ workspaceId: publicWorkspaceId, status: "PUBLISHED" \}/);
  assert.match(publicHome, /service: \{ workspaceId: publicWorkspaceId, active: true \}/);
  assert.match(publicHome, /featuredMedia: \{ project: \{ workspaceId: publicWorkspaceId \} \}/);
  assert.match(adminHome, /getSiteSettings\(session\.workspaceId\)/);
  assert.match(adminHome, /project: \{ workspaceId: session\.workspaceId \}/);
  assert.match(adminHome, /service: \{ workspaceId: session\.workspaceId \}/);
});

test("relational homepage selectors isolate companies and quarantine foreign media", async () => {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE workspace (id TEXT PRIMARY KEY);
    CREATE TABLE project (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspace(id), status TEXT NOT NULL);
    CREATE TABLE service (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspace(id), active BOOLEAN NOT NULL);
    CREATE TABLE media (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES project(id));
    CREATE TABLE homepage_project (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES project(id), active BOOLEAN NOT NULL);
    CREATE TABLE homepage_card (id TEXT PRIMARY KEY, service_id TEXT NOT NULL REFERENCES service(id), featured_media_id TEXT REFERENCES media(id), active BOOLEAN NOT NULL);
    INSERT INTO workspace VALUES ('helios'), ('competitor');
    INSERT INTO project VALUES ('hp', 'helios', 'PUBLISHED'), ('cp', 'competitor', 'PUBLISHED');
    INSERT INTO service VALUES ('hs', 'helios', TRUE), ('cs', 'competitor', TRUE);
    INSERT INTO media VALUES ('hm', 'hp'), ('cm', 'cp');
    INSERT INTO homepage_project VALUES ('hhp', 'hp', TRUE), ('chp', 'cp', TRUE);
    INSERT INTO homepage_card VALUES
      ('safe-helios', 'hs', 'hm', TRUE),
      ('foreign-media', 'hs', 'cm', TRUE),
      ('safe-competitor', 'cs', 'cm', TRUE);
  `);

  const projects = await db.query<{ id: string }>(`
    SELECT hp.id FROM homepage_project hp
    JOIN project p ON p.id = hp.project_id
    WHERE hp.active AND p.status = 'PUBLISHED' AND p.workspace_id = $1
  `, ["helios"]);
  assert.deepEqual(projects.rows, [{ id: "hhp" }]);

  const cards = await db.query<{ id: string }>(`
    SELECT hc.id FROM homepage_card hc
    JOIN service s ON s.id = hc.service_id
    LEFT JOIN media m ON m.id = hc.featured_media_id
    LEFT JOIN project p ON p.id = m.project_id
    WHERE hc.active AND s.active AND s.workspace_id = $1
      AND (hc.featured_media_id IS NULL OR p.workspace_id = $1)
    ORDER BY hc.id
  `, ["helios"]);
  assert.deepEqual(cards.rows, [{ id: "safe-helios" }]);

  await db.close();
});
