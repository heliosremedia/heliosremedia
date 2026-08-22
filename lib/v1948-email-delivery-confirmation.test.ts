import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("Resend webhook is raw-body verified, durable, idempotent, and message-id first", () => {
  const route = read("app/api/webhooks/resend/route.ts");
  assert.match(route, /const rawBody = await request\.text\(\)/);
  assert.match(route, /svix-signature/);
  assert.match(route, /where: \{ providerEventId \}/);
  assert.match(route, /where: \{ providerMessageId \}/);
  assert.match(route, /UNMATCHED_MESSAGE_ID/);
  assert.match(route, /status: 503/);
  assert.match(route, /email\.complained/);
  assert.match(route, /communicationSuppression\.upsert/);
  assert.match(route, /referralCommunication\.findFirst/);
  assert.doesNotMatch(route, /console\.(?:warn|error)\([^\n]*rawBody/);
});

test("delivery migration records provider and processing chronology", () => {
  const migration = read("prisma/migrations/20260803170000_resend_delivery_confirmation_repair/migration.sql");
  for (const field of ["normalizedStatus", "providerEventType", "receivedAt", "processedAt"]) {
    assert.match(migration, new RegExp(field));
  }
});

test("Email Studio exposes tenant-scoped webhook health", () => {
  const page = read("app/admin/email-studio/page.tsx");
  assert.match(page, /Webhook health/);
  assert.match(page, /Last event received/);
  assert.match(page, /Last event processed/);
  assert.match(page, /Recent processing failures/);
  assert.match(page, /Unmatched events/);
  assert.match(page, /workspaceId: session\.workspaceId/);
});

test("campaign sends persist diagnostic tags without changing recipient delivery mapping", () => {
  const provider = read("lib/client-communications/providers/resend.ts");
  assert.match(provider, /tags: \[\{ name: "campaign_id", value: resendTagValue\(input\.campaignId\) \}\]/);
});
