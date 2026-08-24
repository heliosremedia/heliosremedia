import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { approvedQueueBridgeEnabled, mayEnterExistingQueue, socialAutopilotEnabled } from "./autopilot-core.ts";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("autopilot and its queue bridge are independently disabled by default", () => {
  assert.equal(socialAutopilotEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(approvedQueueBridgeEnabled({} as NodeJS.ProcessEnv), false);
});

test("only explicitly approved, non-rejected AI drafts can enter the queue", () => {
  assert.equal(mayEnterExistingQueue({ variantStatus: "DRAFT" }), false);
  assert.equal(mayEnterExistingQueue({ variantStatus: "NEEDS_REVIEW" }), false);
  assert.equal(mayEnterExistingQueue({ variantStatus: "APPROVED", rejectedAt: new Date() }), false);
  assert.equal(mayEnterExistingQueue({ variantStatus: "APPROVED" }), true);
});

test("the additive migration cannot alter protected connection or publishing records", () => {
  const migration = read("prisma/migrations/20260824010000_social_autopilot_foundation/migration.sql");
  for (const table of ["SocialConnection", "SocialOAuthSession", "SocialPublishingJob", "SocialPublishingSnapshot", "SocialPublication"]) {
    assert.doesNotMatch(migration, new RegExp(`(?:UPDATE|DELETE FROM|ALTER TABLE) \\"${table}\\"`, "i"));
  }
});

test("existing discovery, decryption and queue idempotency remain authoritative", () => {
  assert.match(read("lib/social/meta.ts"), /me\/accounts\?fields=id,name,access_token,instagram_business_account/);
  assert.match(read("lib/social/publishing.ts"), /decryptSocialToken/);
  assert.match(read("lib/social/publishing.ts"), /idempotencyKey/);
  assert.match(read("lib/social/security.ts"), /token-crypto/);
  assert.match(read("lib/social/token-crypto.ts"), /aes-256-gcm/i);
  assert.doesNotMatch(read("lib/social/autopilot-core.ts"), /graph\.facebook|instagram\.com/i);
});

test("approved AI drafts delegate to the existing publishing queue", () => {
  const service = read("lib/social/autopilot.ts");
  assert.match(service, /createPublishingJob\(\{ variantId: variant\.id, connectionId: connection\.id \}\)/);
  assert.match(service, /Every variant must be explicitly approved before queueing/);
  assert.match(service, /Rejected autopilot drafts cannot enter the publishing queue/);
  assert.doesNotMatch(service, /fetch\([^)]*(?:graph\.facebook|instagram\.com)/i);
});

test("autopilot client and API responses cannot expose provider credentials", () => {
  const client = read("app/admin/social-studio/SocialAutopilot.tsx");
  const api = read("app/api/admin/social/autopilot/route.ts");
  for (const source of [client, api]) {
    assert.doesNotMatch(source, /accessToken|refreshToken|tokenCiphertext|appSecret|META_APP_SECRET/);
  }
});
