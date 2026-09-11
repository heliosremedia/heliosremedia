import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../prisma/migrations/20260911043000_testimonial_logo_workspace_ownership/migration.sql", import.meta.url), "utf8");

test("brand asset ownership migration preserves Helios data and honors an imported review's company", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE "Workspace" ("id" TEXT PRIMARY KEY, "createdAt" TIMESTAMP NOT NULL);
      CREATE TABLE "SiteSettings" ("id" TEXT PRIMARY KEY, "workspaceId" TEXT);
      CREATE TABLE "Testimonial" (
        "id" TEXT PRIMARY KEY, "published" BOOLEAN NOT NULL, "featured" BOOLEAN NOT NULL,
        "sourceProvider" TEXT NOT NULL, "externalReviewId" TEXT, "displayOrder" INTEGER NOT NULL
      );
      CREATE TABLE "TrustedLogo" ("id" TEXT PRIMARY KEY, "published" BOOLEAN NOT NULL, "displayOrder" INTEGER NOT NULL);
      CREATE TABLE "GoogleBusinessReview" ("id" TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "testimonialId" TEXT UNIQUE);
      CREATE INDEX "Testimonial_published_displayOrder_idx" ON "Testimonial"("published", "displayOrder");
      CREATE INDEX "Testimonial_featured_idx" ON "Testimonial"("featured");
      CREATE INDEX "Testimonial_sourceProvider_published_displayOrder_idx" ON "Testimonial"("sourceProvider", "published", "displayOrder");
      CREATE UNIQUE INDEX "Testimonial_externalReviewId_key" ON "Testimonial"("externalReviewId");
      CREATE INDEX "TrustedLogo_published_displayOrder_idx" ON "TrustedLogo"("published", "displayOrder");
      INSERT INTO "Workspace" VALUES ('helios', '2024-01-01'), ('company-b', '2025-01-01');
      INSERT INTO "SiteSettings" VALUES ('default', 'helios');
      INSERT INTO "Testimonial" VALUES ('manual-helios', true, true, 'MANUAL', 'shared-review', 0), ('google-b', false, false, 'GOOGLE', NULL, 1);
      INSERT INTO "TrustedLogo" VALUES ('helios-logo', true, 0);
      INSERT INTO "GoogleBusinessReview" VALUES ('review-b', 'company-b', 'google-b');
    `);

    // Branding settings and workspace age are not ownership evidence.
    await db.exec('BEGIN');
    await assert.rejects(db.exec(migration), /Verified legacy brand workspace mapping required/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query(`SELECT * FROM "TrustedLogo"`)).rows.length, 1);
    assert.equal((await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'TrustedLogo' AND column_name = 'workspaceId'`)).rows.length, 0);

    await db.exec("SET helios.legacy_brand_workspace_id = 'missing'");
    await db.exec('BEGIN');
    await assert.rejects(db.exec(migration), /Verified legacy brand workspace mapping required/);
    await db.exec('ROLLBACK');

    await db.exec("SET helios.legacy_brand_workspace_id = 'helios'");
    await db.exec(migration);

    assert.deepEqual((await db.query(`SELECT "id", "workspaceId" FROM "Testimonial" ORDER BY "id"`)).rows, [
      { id: "google-b", workspaceId: "company-b" },
      { id: "manual-helios", workspaceId: "helios" },
    ]);
    assert.deepEqual((await db.query(`SELECT "id", "workspaceId" FROM "TrustedLogo"`)).rows, [
      { id: "helios-logo", workspaceId: "helios" },
    ]);

    await assert.rejects(
      db.exec(`INSERT INTO "TrustedLogo" ("id", "workspaceId", "published", "displayOrder") VALUES ('orphan', 'missing', false, 1)`),
      /foreign key/i,
    );
    await db.exec(`INSERT INTO "Testimonial" ("id", "workspaceId", "published", "featured", "sourceProvider", "externalReviewId", "displayOrder") VALUES ('same-provider-id', 'company-b', false, false, 'MANUAL', 'shared-review', 2)`);
    await db.exec(`DELETE FROM "Workspace" WHERE "id" = 'company-b'`);
    assert.equal((await db.query(`SELECT * FROM "Testimonial" WHERE "id" = 'google-b'`)).rows.length, 0);
  } finally {
    await db.close();
  }
});

test("brand asset pages and mutations require and apply workspace ownership", () => {
  const publicHome = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const testimonialRoute = readFileSync(new URL("../app/api/admin/testimonials/route.ts", import.meta.url), "utf8");
  const logoRoute = readFileSync(new URL("../app/api/admin/trusted-logos/route.ts", import.meta.url), "utf8");

  assert.match(publicHome, /testimonial\.findMany\([\s\S]*workspaceId: publicWorkspaceId/);
  assert.match(publicHome, /trustedLogo\.findMany\([\s\S]*workspaceId: publicWorkspaceId/);
  for (const route of [testimonialRoute, logoRoute]) {
    assert.match(route, /\["OWNER", "ADMIN", "EDITOR"\]\.includes\(session\.role\)/);
    assert.match(route, /workspaceId: session\.workspaceId/);
    assert.match(route, /deleteMany/);
  }
});
