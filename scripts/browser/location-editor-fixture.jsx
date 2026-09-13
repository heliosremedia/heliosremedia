// Browser-only synthetic responses. No production API, storage or AI requests.
import React from "react";
import { createRoot } from "react-dom/client";
import LocationPageManager from "../../app/admin/locations/LocationPageManager";

const row = { slug: "town", state: "State", county: "County", heroLead: "Original lead", introduction: "Intro", marketTitle: "Market", marketCopy: "Copy",
  seoTitle: "Title", seoDescription: "Description", localDetails: ["Detail"], serviceArea: "Area", ctaHeadline: null,
  featureImageStorageKey: null, featureImageUrl: null, featureImageAlt: null, featureImageFocalX: 0.5, featureImageFocalY: 0.5,
  published: false, createdAt: "2026-09-13T00:00:00.000Z", updatedAt: "2026-09-13T00:00:00.000Z" };
const fixture = window.locationFixture = { calls: [], mode: "success", pending: null, upload: null, ai: null };
window.fetch = async (url, options = {}) => {
  fixture.calls.push({ url, method: options.method, body: options.method === "PUT" ? "synthetic-file" : options.body });
  if (url === "/api/admin/locations" && options.method === "PATCH" && JSON.parse(options.body).action === "reorder") {
    await new Promise(resolve => { fixture.pending = resolve; });
    fixture.pending = null;
    if (fixture.mode === "lost-ack") throw new Error("Synthetic unconfirmed response");
    if (fixture.mode === "conflict") return Response.json({ success: false, error: "PRIVATE synthetic conflict" }, { status: 409 });
    if (fixture.mode === "non-json") return new Response("Synthetic invalid response", { status: 200 });
    if (fixture.mode === "negative") return Response.json({ success: false });
    return Response.json({ success: true });
  }
  if (url === "/api/admin/locations/presign" && options.method === "POST") return Response.json({ success: true,
    upload: { key: "workspaces/synthetic/locations/one.png", publicUrl: "/synthetic-image", uploadUrl: "/synthetic-upload", contentType: "image/png" } });
  if (url === "/synthetic-upload" && options.method === "PUT") {
    await new Promise(resolve => { fixture.upload = resolve; }); fixture.upload = null;
    return new Response(null, { status: 200 });
  }
  if (url === "/api/admin/locations/ai" && options.method === "POST") {
    await new Promise(resolve => { fixture.ai = resolve; }); fixture.ai = null;
    return Response.json({ success: true, draft: { heroLead: "Synthetic draft for the original page" } });
  }
  throw new Error(`Unexpected synthetic request: ${options.method} ${url}`);
};
createRoot(document.getElementById("root")).render(<LocationPageManager initialLocations={[
  { ...row, id: "one", city: "One", displayOrder: 0 }, { ...row, id: "two", city: "Two", displayOrder: 1 },
]} />);
