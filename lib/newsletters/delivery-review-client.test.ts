import assert from "node:assert/strict";
import test from "node:test";
import { requestDeliveryReview } from "../../app/admin/newsletter-studio/components/delivery-review-client.ts";

test("review client sends only confirmed action and reviewed version to the edition endpoint", async () => {
  const controller = new AbortController();
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const transport = (async (url, init) => {
    requests.push({ url: String(url), init: init! });
    return Response.json({ success: true, review: { editionId: "edition/one", rowVersion: 7, delivery: null } });
  }) as typeof fetch;
  assert.equal((await requestDeliveryReview("edition/one", undefined, controller.signal, transport))?.rowVersion, 7);
  assert.equal(requests[0].url, "/api/admin/newsletters/editions/edition%2Fone/delivery-review");
  assert.equal(requests[0].init.cache, "no-store"); assert.equal(requests[0].init.method, "GET"); assert.equal(requests[0].init.body, undefined);
  assert.equal(await requestDeliveryReview("edition/one", { confirmation: "FINALIZE_ACCEPTED_DELIVERY", expectedVersion: 7 }, controller.signal, transport), null);
  assert.equal(requests[1].init.method, "POST"); assert.equal(requests[1].init.signal, controller.signal);
  assert.deepEqual(JSON.parse(String(requests[1].init.body)), { confirmation: "FINALIZE_ACCEPTED_DELIVERY", expectedVersion: 7 });
});

test("review client refuses foreign or malformed snapshots and never retries a failed mutation", async () => {
  for (const review of [null, { editionId: "foreign", rowVersion: 7 }, { editionId: "edition", rowVersion: "7" }]) {
    await assert.rejects(requestDeliveryReview("edition", undefined, undefined, (async () => Response.json({ success: true, review })) as typeof fetch), /could not be verified/);
  }
  for (const status of [403, 409, 500]) {
    let calls = 0;
    await assert.rejects(requestDeliveryReview("edition", { confirmation: "REPAIR_ACCEPTED_DELIVERY_RECORDS", expectedVersion: 7 }, undefined, (async () => {
      calls++; return Response.json({ success: false, error: "internal provider detail" }, { status });
    }) as typeof fetch), status === 403 ? /Administrator access/ : /Refresh the review/);
    assert.equal(calls, 1);
  }
});
