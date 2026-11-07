import test from "node:test";
import assert from "node:assert/strict";
import { renderSummaryPdf, summaryPdfAttachment } from "./pdf.ts";
import { sampleSummary } from "./email.ts";

test("held or empty reports cannot produce attachments", async () => {
  await assert.rejects(renderSummaryPdf({ ...sampleSummary("2026-10"), issues: ["Unverified order"] }));
  await assert.rejects(renderSummaryPdf({ ...sampleSummary("2026-10"), orderCount: 0 }));
});
test("attachment survives saved JSON payload serialization as a PDF", async () => {
  const attachment = await summaryPdfAttachment(sampleSummary("2026-10"));
  const saved = JSON.parse(JSON.stringify({ attachments: [attachment] }));
  assert.equal(saved.attachments[0].filename, "Helios-Media-Summary-2026-10.pdf");
  assert.equal(saved.attachments[0].contentType, "application/pdf");
  const bytes = Buffer.from(saved.attachments[0].content, "base64");
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(bytes.length < 5 * 1024 * 1024);
});
