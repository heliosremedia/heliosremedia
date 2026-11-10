import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDraftPreviewLoader, draftPreviewDocument, draftPreviewPayload } from "./draft-preview.ts";
import { createEventForm } from "./ui-helpers.ts";

const form = {
  ...createEventForm(), title: "Unsaved winter dinner", description: "Bring a friend.",
  location: "New studio address", venueUrl: "https://venue.example.com/parking",
  imageUrl: "https://assets.example.com/new-cover.png", imageAlt: "Snowy trees",
  startsAt: "2027-12-15T18:30", endsAt: "2027-12-15T21:00", timeZone: "America/Denver",
  emailContent: { REMINDER: { subject: "Custom reminder", body: "Looking forward to seeing you." } },
  mode: "INDIVIDUALS", clientIds: ["private-client-id"], groupIds: ["private-group-id"],
};
const output = (subject: string) => ({ success: true, subject, html: `<p>${subject}</p>`, placeholders: [] });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("preview sends current unsaved presentation fields, override style and stage, never recipients or save actions", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const loader = createDraftPreviewLoader(async (url, init) => { calls.push({ url: String(url), init }); return Response.json(output("Current draft")); });
  const before = JSON.stringify(form);
  assert.equal((await loader.load(form, "CHRISTMAS", "REMINDER"))?.subject, "Current draft");
  assert.equal(calls[0].url, "/api/admin/events/preview");
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(calls[0].init?.cache, "no-store");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    title: form.title, description: form.description, location: form.location, venueUrl: form.venueUrl,
    emailContent: form.emailContent, startsAt: "2027-12-16T01:30:00.000Z", timeZone: form.timeZone,
    templateKey: "CHRISTMAS", imageUrl: form.imageUrl, imageAlt: form.imageAlt, stage: "REMINDER",
  });
  assert.equal(JSON.stringify(form), before);
  const current = { ...form, title: "Edited again", imageUrl: "", imageAlt: "", venueUrl: "", emailContent: {} };
  await loader.load(current, "EASTER", "FOLLOW_UP");
  const second = JSON.parse(String(calls[1].init?.body));
  assert.equal(second.title, "Edited again"); assert.equal(second.imageUrl, ""); assert.equal(second.venueUrl, "");
  assert.equal(second.templateKey, "EASTER"); assert.equal(second.stage, "FOLLOW_UP"); assert.deepEqual(second.emailContent, {});
});

test("an empty draft requests labeled samples without inventing persisted form values", () => {
  const empty = createEventForm();
  assert.equal(draftPreviewPayload(empty, "NEW_YEAR", "INITIAL").startsAt, null);
  assert.equal(empty.title, ""); assert.equal(empty.startsAt, "");
  assert.throws(() => draftPreviewPayload({ ...empty, startsAt: "invalid" }, "CLASSIC", "INITIAL"), /valid date/);
});

test("rapid style/stage switching aborts prior fetch and discards out-of-order success", async () => {
  const calls: { pending: ReturnType<typeof deferred<Response>>; signal: AbortSignal }[] = [];
  const loader = createDraftPreviewLoader(async (_url, init) => {
    const pending = deferred<Response>(); calls.push({ pending, signal: init!.signal as AbortSignal }); return pending.promise;
  });
  const first = loader.load(form, "CHRISTMAS", "INITIAL");
  const second = loader.load(form, "SUMMER", "REMINDER");
  assert.equal(calls[0].signal.aborted, true);
  calls[1].pending.resolve(Response.json(output("Latest reminder")));
  assert.equal((await second)?.subject, "Latest reminder");
  calls[0].pending.resolve(Response.json(output("Stale invitation")));
  assert.equal(await first, null);
});

for (const phase of ["fetch", "json", "error"] as const) test(`closing during ${phase} prevents a late result from reopening the preview`, async () => {
  const pending = deferred<Response>();
  const json = deferred<unknown>();
  let signal: AbortSignal | null = null;
  const loader = createDraftPreviewLoader(async (_url, init) => { signal = init!.signal as AbortSignal; return pending.promise; });
  const loading = loader.load(form, "HALLOWEEN", "INITIAL");
  if (phase === "json") {
    pending.resolve({ ok: true, json: () => json.promise } as Response);
    await Promise.resolve(); await Promise.resolve();
  }
  loader.cancel();
  assert.equal((signal as AbortSignal | null)?.aborted, true);
  if (phase === "error") pending.reject(new Error("Late network error"));
  else if (phase === "json") json.resolve(output("Stale parse result"));
  else pending.resolve(Response.json(output("Late result")));
  assert.equal(await loading, null);
});

test("reopening and repeated requests use fresh data while older failures are ignored", async () => {
  const calls: ReturnType<typeof deferred<Response>>[] = [];
  const loader = createDraftPreviewLoader(async () => { const pending = deferred<Response>(); calls.push(pending); return pending.promise; });
  const abandoned = loader.load(form, "CHRISTMAS", "INITIAL");
  loader.cancel();
  const reopened = loader.load({ ...form, title: "Changed after closing" }, "EASTER", "INITIAL");
  calls[1].resolve(Response.json(output("Changed after closing")));
  assert.equal((await reopened)?.subject, "Changed after closing");
  calls[0].reject(new Error("Request from the closed dialog"));
  assert.equal(await abandoned, null);
  const repeated = loader.load(form, "EASTER", "INITIAL");
  calls[2].resolve(Response.json(output("Repeated click works")));
  assert.equal((await repeated)?.subject, "Repeated click works");
});

test("an invalid new request cancels old content and server errors are actionable", async () => {
  const pending = deferred<Response>();
  const loader = createDraftPreviewLoader(async () => pending.promise);
  const old = loader.load(form, "CLASSIC", "INITIAL");
  await assert.rejects(loader.load({ ...form, startsAt: "invalid" }, "CLASSIC", "INITIAL"), /valid date/);
  pending.resolve(Response.json(output("Old")));
  assert.equal(await old, null);
  const denied = createDraftPreviewLoader(async () => Response.json({ success: false, error: "Administrator access required." }, { status: 401 }));
  await assert.rejects(denied.load(form, "CLASSIC", "INITIAL"), /Administrator access/);
  const malformed = createDraftPreviewLoader(async () => Response.json({ success: true }));
  await assert.rejects(malformed.load(form, "CLASSIC", "INITIAL"), /could not be loaded/);
});

test("editor preview is non-submitting, sandboxed and closes without saving or applying a browsed style", () => {
  const appearance = readFileSync(new URL("./EventAppearance.tsx", import.meta.url), "utf8");
  const component = readFileSync(new URL("./EventDraftPreview.tsx", import.meta.url), "utf8");
  const studio = readFileSync(new URL("./EventStudio.tsx", import.meta.url), "utf8");
  assert.match(appearance, /type="button"[^>]+onClick=\{onPreview\}>Preview invitation/);
  assert.match(studio, /<EventDraftPreview form=\{form\} onClose=\{\(\) => setDraftPreviewOpen\(false\)\}/);
  assert.match(studio, /onApplyStyle=\{templateKey => \{ field\("templateKey", templateKey\); setDraftPreviewOpen\(false\); \}\}/);
  assert.match(component, /<iframe[^>]+sandbox="allow-same-origin"[^>]+referrerPolicy="no-referrer"[^>]+tabIndex=\{0\}/);
  assert.match(component, /width === "MOBILE" \? 375 : 760/);
  assert.match(component, /function close\(\) \{ detachFrameKeyboard\(\); loader.cancel\(\); latestOnClose.current\(\); \}/);
  assert.doesNotMatch(component, /<button(?![^>]*type="button")/);
  assert.doesNotMatch(component, /save\(|schedule\(|emailAction\(/);
  assert.match(component, /dialog\?\.showModal\(\)/); assert.match(component, /previousFocus\?\.focus\(\)/);
  assert.match(component, /onCancel=\{event => \{ event.preventDefault\(\); close\(\); \}\}/);
  assert.match(component, /event.target !== event.currentTarget/); assert.match(component, /aria-modal="true"/);
});


test("preview keeps real email styles while neutralizing every venue and unsubscribe link", () => {
  const html = '<a href="https://venue.example.com?a=1&amp;b=2" style="color:#fff">View venue</a><a href="https://studio.example/unsubscribe?token=test-preview-disabled">Unsubscribe</a><img src="https://assets.example/a.png">';
  const safe = draftPreviewDocument(html);
  assert.doesNotMatch(safe, /href=/);
  assert.equal((safe.match(/aria-disabled="true"/g) || []).length, 2);
  assert.match(safe, /style="color:#fff"/);
  assert.match(safe, /src="https:\/\/assets.example\/a.png"/);
});
