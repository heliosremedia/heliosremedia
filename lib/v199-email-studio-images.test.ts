import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Email Studio supports library and direct-upload campaign images", () => {
  const studio = read("app/admin/email-studio/BulkEmailStudio.tsx");
  const presign = read("app/api/admin/email-images/presign/route.ts");
  assert.match(studio, /Media Library/);
  assert.match(studio, /Upload Image/);
  assert.match(studio, /Accessibility description/);
  assert.match(studio, /\/api\/admin\/newsletters\/images/);
  assert.match(studio, /\/api\/admin\/email-images\/presign/);
  assert.match(presign, /createEmailCampaignImageKey/);
});

test("campaign image metadata persists and reaches delivery rendering", () => {
  const schema = read("prisma/schema.prisma");
  const route = read("app/api/admin/email-campaigns/route.ts");
  const delivery = read("lib/client-communications/campaign-delivery.ts");
  const renderer = read("lib/client-communications/email.ts");
  assert.match(schema, /imageUrl\s+String\?/);
  assert.match(schema, /imageAlt\s+String\?/);
  assert.match(route, /Add an accessibility description before sending an image/);
  assert.match(delivery, /imageUrl: campaign\.imageUrl/);
  assert.match(renderer, /<img src=/);
});

test("campaign history controls expose usable hover and focus states", () => {
  const studio = read("app/admin/email-studio/BulkEmailStudio.tsx");
  const styles = read("app/globals.css");
  assert.match(studio, /Reschedule/);
  assert.match(studio, /Send Now/);
  assert.match(studio, /hover:bg-white/);
  assert.match(studio, /focus-visible:ring-2/);
  assert.match(studio, /text-\[0\.46rem\]/);
  assert.match(studio, /email-studio-history-action/);
  assert.match(styles, /button\.email-studio-history-action/);
  assert.match(styles, /font-size: 0\.64rem !important/);
});
