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
  fixture.calls.push({ url, method: options.method, headers: options.headers, body: options.method === "PUT" ? "synthetic-file" : options.body });
  if (url === "/api/admin/locations" && options.method === "PATCH" && JSON.parse(options.body).action === "reorder") {
    await new Promise(resolve => { fixture.pending = resolve; });
    fixture.pending = null;
    if (fixture.mode === "lost-ack") throw new Error("Synthetic unconfirmed response");
    if (fixture.mode === "conflict") return Response.json({ success: false, error: "PRIVATE synthetic conflict" }, { status: 409 });
    if (fixture.mode === "non-json") return new Response("Synthetic invalid response", { status: 200 });
    if (fixture.mode === "negative") return Response.json({ success: false });
    if (fixture.mode === "legacy-order") return Response.json({ success: true });
    if (fixture.mode === "foreign-order") return Response.json({ success: true, revisionProtocol: 1, order: [
      { id: "foreign", displayOrder: 0, updatedAt: row.updatedAt }, { id: "one", displayOrder: 1, updatedAt: row.updatedAt },
    ] });
    return Response.json({ success: true, revisionProtocol: 1, order: [
      { id: "two", displayOrder: 0, updatedAt: "2026-09-13T01:00:00.000Z" }, { id: "one", displayOrder: 1, updatedAt: "2026-09-13T01:00:00.000Z" },
    ] });
  }
  if (url === "/api/admin/locations" && options.method === "PATCH") {
    const body = JSON.parse(options.body);
    if (!["update", "publish"].includes(body.action)) throw new Error("Unexpected synthetic mutation");
    await new Promise(resolve => { fixture.pending = resolve; }); fixture.pending = null;
    if (fixture.mode === "save-conflict") return Response.json({ success: false, error: "PRIVATE conflict" }, { status: 409 });
    if (fixture.mode === "save-lost-ack") throw new Error("Synthetic lost save acknowledgement");
    const location = { ...row, id: body.locationId, city: body.locationId === "one" ? "One" : "Two", displayOrder: 0, ...body, updatedAt: "2026-09-13T02:00:00.000Z" };
    if (fixture.mode === "save-legacy") return Response.json({ success: true, location });
    return Response.json({ success: true, revisionProtocol: 1, location });
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
