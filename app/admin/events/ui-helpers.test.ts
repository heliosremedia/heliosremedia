import test from "node:test";
import assert from "node:assert/strict";
import { createEventForm, resetEventEmailStage, setEventEmailField, eventAppearance, eventImageUploadError, selectEventImage, displayDate, localDateTime, responseCounts } from "./ui-helpers.ts";
import { getEventEmailCopy } from "../../../lib/events/themes.ts";
import { zonedLocalToUtc } from "../../../lib/client-communications/scheduling.ts";

test("unspecified dates remain blank rather than fabricating a date", () => {
  assert.equal(localDateTime(null, "America/Denver"), "");
  assert.equal(displayDate(null, "America/Denver"), "Date not set");
});
test("event editor round-trips the chosen timezone, independent of browser timezone", () => {
  for (const iso of ["2027-01-15T16:00:00.000Z", "2027-07-15T15:00:00.000Z"]) {
    const local = localDateTime(iso, "America/Denver");
    assert.equal(local.slice(11), "09:00");
    assert.equal(zonedLocalToUtc(local, "America/Denver").toISOString(), iso);
  }
});
test("RSVP summary counts yes, no, maybe and pending separately", () => {
  assert.deepEqual(responseCounts([{ response: "YES" }, { response: "NO" }, { response: "YES" }, { response: "PENDING" }, { response: "MAYBE" }]), { total: 5, yes: 2, no: 1, maybe: 1, pending: 1 });
  assert.deepEqual(responseCounts(), { total: 0, yes: 0, no: 0, maybe: 0, pending: 0 });
});


test("new and legacy drafts default to Classic without an image", () => {
  assert.deepEqual(eventAppearance(), { templateKey: "CLASSIC", imageUrl: "", imageAlt: "" });
  assert.deepEqual(eventAppearance({ templateKey: "UNKNOWN", imageAlt: "orphaned" }), eventAppearance());
  const form = createEventForm();
  assert.equal(form.startsAt, "");
  assert.equal(form.templateKey, "CLASSIC");
  assert.deepEqual(form.emailContent, {});
});
const savedEvent = { title: "Holiday party", description: "Join us", location: "The venue", venueUrl: "https://venue.example/", startsAt: "2026-12-17T01:00:00.000Z", endsAt: null, timeZone: "America/Denver", mode: "GROUPS", groupIds: ["group-1"], templateKey: "CHRISTMAS", imageUrl: "https://assets.example/party.png", imageAlt: "Evergreen wreath", emailContent: { REMINDER: { subject: "See you tomorrow", body: "We are looking forward to seeing you!" } } };

test("image selection and removal preserve date, audience, venue and per-stage copy", () => {
  const form = createEventForm(savedEvent);
  const replaced = selectEventImage(form, { url: "https://assets.example/new.png", altText: "New banner" });
  assert.equal(replaced.imageAlt, "New banner");
  const removed = selectEventImage(replaced, null);
  assert.deepEqual(removed, { ...form, imageUrl: "", imageAlt: "" });
  assert.equal(form.imageAlt, "Evergreen wreath");
  assert.equal(removed.startsAt, "2026-12-16T18:00");
});

test("cancel and reopen restores persisted appearance and copy without shared mutable selections", () => {
  const first = createEventForm(savedEvent);
  first.templateKey = "HALLOWEEN";
  first.groupIds.push("unsaved-group");
  first.emailContent.REMINDER!.body = "unsaved text";
  assert.deepEqual(createEventForm(savedEvent).groupIds, ["group-1"]);
  assert.equal(createEventForm(savedEvent).templateKey, "CHRISTMAS");
  assert.equal(createEventForm(savedEvent).emailContent.REMINDER?.body, savedEvent.emailContent.REMINDER.body);
  assert.equal(createEventForm({ ...savedEvent, templateKey: "EASTER", imageUrl: null, imageAlt: null }).templateKey, "EASTER");
});

test("uploads reject empty, oversized, animated or unsupported files before starting", () => {
  assert.equal(eventImageUploadError({ type: "image/jpeg", size: 10 * 1024 * 1024 }), null);
  assert.equal(eventImageUploadError({ type: "image/png", size: 100 }), null);
  assert.match(eventImageUploadError({ type: "image/png", size: 0 })!, /empty/);
  assert.match(eventImageUploadError({ type: "image/png", size: 10 * 1024 * 1024 + 1 })!, /10 MB/);
  for (const type of ["image/svg+xml", "image/gif", "image/webp", "text/html"]) assert.match(eventImageUploadError({ type, size: 100 })!, /JPG or PNG/);
});


test("resetting saved stage copy sends explicit empty overrides and leaves other stages untouched", () => {
  const original = { INITIAL: { subject: "Custom invite", body: "Join us!" }, REMINDER: { subject: "Custom reminder", body: "See you tomorrow" } };
  const reset = resetEventEmailStage(original, "REMINDER");
  assert.deepEqual(reset.REMINDER, { subject: "", body: "" });
  assert.deepEqual(reset.INITIAL, original.INITIAL);
  assert.match(getEventEmailCopy({ ...savedEvent, emailContent: reset }, "REMINDER").body, /looking forward/);
});

test("editing only a subject preserves the automatic body as event details change", () => {
  const emailContent = setEventEmailField({}, "FOLLOW_UP", "subject", "A friendly reminder");
  assert.deepEqual(emailContent.FOLLOW_UP, { subject: "A friendly reminder", body: "" });
  const resolved = getEventEmailCopy({ ...savedEvent, description: "Updated details", emailContent }, "FOLLOW_UP");
  assert.equal(resolved.subject, "A friendly reminder");
  assert.match(resolved.body, /Updated details/);
});
