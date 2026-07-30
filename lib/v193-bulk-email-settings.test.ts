import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("signed bounce processing is idempotent and provider-message owned", () => {
  const route = read("app/api/webhooks/resend/route.ts");
  const processor = read("lib/client-communications/bounces.ts");
  assert.match(route, /svix-signature/);
  assert.match(route, /processPermanentBounce/);
  assert.match(processor, /providerEventId/);
  assert.match(processor, /FAILED_RETRYABLE/);
  assert.match(processor, /providerMessageId/);
  assert.match(processor, /createdBy: \{ select: \{ workspaceId: true \} \}/);
  assert.match(processor, /REJECTED_AMBIGUOUS_OWNER/);
  assert.match(processor, /IGNORED_OUT_OF_ORDER/);
  assert.match(processor, /skipDuplicates: true/);
  assert.match(processor, /CLIENT_PERMANENT_BOUNCE_RECORDED/);
  assert.doesNotMatch(processor, /communicationClient\.findMany\(\{\s*where: \{ normalizedEmail/);
});

test("campaign stages and deliberate recovery enforce workspace bounce membership", () => {
  for (const path of [
    "app/admin/email-studio/page.tsx",
    "app/api/admin/email-campaigns/route.ts",
    "lib/client-communications/campaign-delivery.ts",
  ]) assert.match(read(path), /bouncedBackSystemKey/);
  const memberships = read("app/api/admin/client-groups/memberships/route.ts");
  assert.match(memberships, /removableWorkspaceBounceGroup/);
  assert.match(memberships, /operation === "remove"/);
});

test("Bulk Email Studio exposes accessible compact interactions", () => {
  const studio = read("app/admin/email-studio/BulkEmailStudio.tsx");
  assert.match(studio, /useState\(false\)/);
  assert.match(studio, /aria-expanded=\{aiExpanded\}/);
  assert.match(studio, /aria-controls="email-ai-assistant"/);
  assert.match(studio, /aria-live="polite"/);
  assert.match(studio, /aria-pressed=\{mode === value\}/);
  assert.match(studio, /View campaign:/);
  assert.match(studio, /Preview Recipient/);
  assert.doesNotMatch(studio, /sticky top-6/);
});

test("Site Settings has unified identity and complete destinations", () => {
  const form = read("app/admin/settings/SiteSettingsForm.tsx");
  for (const destination of ["brand-identity", "brand-assets", "booking-experience", "content-discovery", "legal-privacy"]) {
    assert.match(form, new RegExp(destination));
  }
  assert.match(form, /Brand Identity/);
  assert.match(form, /Business and contact/);
  assert.match(form, /Location and public messaging/);
  assert.match(form, /Social and website/);
  assert.match(form, /aria-expanded/);
  assert.match(form, /revealInvalidParent/);
});

test("V1.9.3 begins in deploying state with matching navigation", () => {
  assert.match(read("lib/version.ts"), /STUDIO_VERSION = "V1\.9\.3"/);
  const releases = read("lib/releases.ts");
  assert.ok(releases.indexOf('version: "V1.9.3"') < releases.indexOf('version: "V1.9.2"'));
  assert.match(releases, /title: "Bulk Email and Site Settings Refinement"/);
  assert.match(releases, /releaseDate: null/);
  assert.match(releases, /status: "DEPLOYING"/);
});

test("bounce migration is additive and indexed", () => {
  const migration = read("prisma/migrations/20260730153000_v193_resend_bounce_events/migration.sql");
  assert.match(migration, /CREATE TABLE "ResendWebhookEvent"/);
  assert.match(migration, /providerEventId_key/);
  assert.match(migration, /processingStatus_idx/);
  assert.doesNotMatch(migration, /\bDROP\b|\bDELETE\s+FROM\b|\bTRUNCATE\b/i);
});

test("system group controls expose only deliberate current-workspace removal", () => {
  const directory = read("app/admin/clients/ClientDirectory.tsx");
  const page = read("app/admin/clients/page.tsx");
  assert.match(page, /bouncedBackSystemKey\(session\.workspaceId\)/);
  assert.match(directory, /!group\.systemManaged/);
  assert.match(directory, /systemKey\?\.startsWith\("BOUNCED_BACK:"\)/);
  assert.match(directory, /updateMembership\("remove"\)/);
});
