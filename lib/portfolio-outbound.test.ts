import assert from "node:assert/strict";
import test from "node:test";
import { normalizedOutboundKey, outboundDestinationLabel, parseReportableOutboundUrl } from "./portfolio-outbound.ts";

test("outbound reporting excludes Helios navigation and media asset URLs", () => {
  for (const url of [
    "https://heliosrealestatemedia.com/portfolio",
    "https://bucket.r2.dev/photo.JPG",
    "https://customer.videodelivery.net/id/thumbnails/thumbnail.jpg",
    "https://cdn.example.com/poster.webp",
    "https://example.com/video.mp4",
  ]) assert.equal(parseReportableOutboundUrl(url, "https://heliosrealestatemedia.com"), null);
  assert.equal(parseReportableOutboundUrl("https://ClientExample.com/Listing?Ref=Helios")?.href, "https://clientexample.com/Listing?Ref=Helios");
});

test("destination variants aggregate without altering the inspected URL", () => {
  assert.equal(normalizedOutboundKey("https://www.Example.com/Listing/?utm_source=one&A=1"), "example.com/listing?A=1");
  assert.equal(normalizedOutboundKey("https://example.com/listing?A=1&utm_medium=two"), "example.com/listing?A=1");
  assert.equal(outboundDestinationLabel("https://www.facebook.com/page"), "Facebook");
  assert.equal(outboundDestinationLabel("https://book.hdphotohub.com/order"), "Booking Provider");
  assert.equal(outboundDestinationLabel("https://ClientExample.com/Listing"), "Client Website");
});
