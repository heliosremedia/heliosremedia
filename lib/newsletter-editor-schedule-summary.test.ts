import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("scheduled newsletter editors show the exact Mountain Time delivery", () => {
  const source = readFileSync(
    new URL("../app/admin/newsletter-studio/components/EditionEditor.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /edition\.status === "SCHEDULED"/);
  assert.match(source, /scheduledDelivery\(edition\.intendedSendAt\)/);
  assert.match(source, /timeZone: "America\/Denver"/);
  assert.match(source, /Mountain Time · America\/Denver/);
});
