import assert from "node:assert/strict";
import test from "node:test";
import { summarizeNewsletterCampaign } from "./analytics-core.ts";

test("newsletter analytics deduplicate recipient opens and clicks", () => {
  const result = summarizeNewsletterCampaign(
    [
      {
        id: "one",
        status: "SENT",
        events: [
          { eventType: "DELIVERED" },
          { eventType: "OPENED" },
          { eventType: "OPENED" },
          { eventType: "CLICKED", linkUrl: "https://helios.test/work" },
          { eventType: "CLICKED", linkUrl: "https://helios.test/work" },
        ],
      },
      {
        id: "two",
        status: "FAILED",
        events: [{ eventType: "BOUNCED" }],
      },
    ],
    3,
    1,
  );

  assert.equal(result.sent, 2);
  assert.equal(result.delivered, 1);
  assert.equal(result.estimatedUniqueOpens, 1);
  assert.equal(result.uniqueClicks, 1);
  assert.equal(result.topLinks[0]?.count, 2);
  assert.equal(result.unsubscribes, 1);
  assert.equal(result.bounces, 1);
  assert.equal(result.failed, 1);
});

test("newsletter analytics remain stable when provider events arrive out of order", () => {
  const result = summarizeNewsletterCampaign(
    [
      {
        id: "one",
        status: "SENT",
        events: [
          { eventType: "CLICKED", linkUrl: "https://helios.test/book" },
          { eventType: "DELIVERED" },
          { eventType: "DELAYED" },
        ],
      },
    ],
    1,
  );

  assert.equal(result.deliveryRate, 100);
  assert.equal(result.clickThroughRate, 100);
  assert.equal(result.delayed, 1);
});
