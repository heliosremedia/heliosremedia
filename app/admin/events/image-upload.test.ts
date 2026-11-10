import test from "node:test";
import assert from "node:assert/strict";
import { uploadEventImage } from "./image-upload.ts";

const file = new File(["image bytes"], "christmas-banner.png", { type: "image/png" });
const presign = { success: true, upload: { key: "staging-key", uploadUrl: "https://upload.example/staging", publicUrl: "https://assets.example/UNVERIFIED.png", contentType: "image/png" } };

test("image upload finalizes validated bytes and returns only the immutable URL", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const request: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return calls.length === 1 ? Response.json(presign) : calls.length === 2 ? new Response(null, { status: 200 }) : Response.json({ success: true, imageUrl: "https://assets.example/final.png" });
  };
  const image = await uploadEventImage(file, new AbortController().signal, request);
  assert.deepEqual(image, { url: "https://assets.example/final.png", altText: "christmas banner" });
  assert.equal(calls[1].init?.method, "PUT");
  assert.equal(calls[1].init?.referrerPolicy, "no-referrer");
  assert.equal(calls[2].url, "/api/admin/events/images/complete");
  assert.deepEqual(JSON.parse(String(calls[2].init?.body)), { key: "staging-key" });
});

for (const canceledStage of [1, 2, 3]) test(`cancelling at upload stage ${canceledStage} ignores late results`, async () => {
  const controller = new AbortController();
  let count = 0;
  const request: typeof fetch = async () => {
    count += 1;
    if (count === canceledStage) controller.abort();
    // Deliberately ignore fetch cancellation to model a late network response.
    return count === 1 ? Response.json(presign) : count === 2 ? new Response() : Response.json({ success: true, imageUrl: "https://assets.example/late.png" });
  };
  await assert.rejects(uploadEventImage(file, controller.signal, request), { name: "AbortError" });
  assert.equal(count, canceledStage);
});

test("failed verification never applies the staging image", async () => {
  let count = 0;
  const request: typeof fetch = async () => ++count === 1 ? Response.json(presign) : count === 2 ? new Response() : Response.json({ success: false, error: "Not a PNG image" }, { status: 400 });
  await assert.rejects(uploadEventImage(file, new AbortController().signal, request), /Not a PNG/);
});
