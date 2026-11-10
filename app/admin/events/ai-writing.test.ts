import test from "node:test";
import assert from "node:assert/strict";
import { EVENT_AI_STAGES, type EventAIDraft } from "../../../lib/events/ai-contract.ts";
import { createEventForm } from "./ui-helpers.ts";
import { applyEventAIStages, createEventAIWriter, customizedEventAIStages, eventAIEditorPayload, validEventAIStage } from "./ai-writing.ts";

const source = { ...createEventForm(), title: "Party", description: "Celebrate together", startsAt: "2030-12-15T18:00", endsAt: "2030-12-15T20:00", location: "Studio", clientIds: ["private"], groupIds: ["secret"] };
const draft = Object.fromEntries(EVENT_AI_STAGES.map(stage => [stage, { subject: `${stage} subject`, body: `${stage} message` }])) as EventAIDraft;
const success = (value = draft) => Response.json({ success: true, draft: value });

test("writer payload includes only seven event fields and tone, converts timezone and omits guest/copy/style data", () => {
  const payload = eventAIEditorPayload({ ...source, emailContent: { INITIAL: { subject: "Secret", body: "Private" } } } as typeof source, "Warm and welcoming");
  assert.deepEqual(Object.keys(payload).sort(), ["description", "endsAt", "location", "startsAt", "timeZone", "title", "tone", "venueUrl"]);
  assert.equal(payload.startsAt, "2030-12-16T01:00:00.000Z"); assert.equal(payload.endsAt, "2030-12-16T03:00:00.000Z"); assert(!JSON.stringify(payload).includes("Private")); assert(!JSON.stringify(payload).includes("secret"));
});

test("latest request wins and late cancelled responses cannot replace results", async () => {
  const calls: { signal: AbortSignal; resolve: (value: Response) => void }[] = [];
  const writer = createEventAIWriter(async (url, init) => { assert.equal(url, "/api/admin/events/ai"); assert.equal(init?.method, "POST"); return new Promise(resolve => calls.push({ signal: init?.signal as AbortSignal, resolve })); });
  const first = writer.generate(source, "Warm and welcoming"); const second = writer.generate(source, "Festive and upbeat");
  assert.equal(calls[0].signal.aborted, true); calls[1].resolve(success()); assert.deepEqual(await second, draft);
  calls[0].resolve(success({ ...draft, INITIAL: { subject: "Stale", body: "Old" } })); assert.equal(await first, null);
  const third = writer.generate(source, "Casual and friendly"); writer.cancel(); assert.equal(calls[2].signal.aborted, true); calls[2].resolve(success()); assert.equal(await third, null);
});

test("cancellation during body decode and stale errors are ignored", async () => {
  let finish!: (data: unknown) => void;
  const writer = createEventAIWriter(async () => ({ ok: true, json: () => new Promise(resolve => { finish = resolve; }) }) as Response);
  const pending = writer.generate(source, "Warm and welcoming"); await Promise.resolve(); writer.cancel(); finish({ success: true, draft }); assert.equal(await pending, null);
  let reject!: (reason: Error) => void;
  const failing = createEventAIWriter(() => new Promise((_resolve, fail) => { reject = fail; }));
  const failure = failing.generate(source, "Warm and welcoming"); failing.cancel(); reject(new Error("private old error")); assert.equal(await failure, null);
});

test("safe failures do not leak response diagnostics and invalid provider output cannot enter review", async () => {
  for (const response of [Response.json({ error: "private diagnostics" }, { status: 500 }), Response.json({ success: true, draft: { INITIAL: draft.INITIAL } })]) {
    const writer = createEventAIWriter(async () => response);
    await assert.rejects(writer.generate(source, "Warm and welcoming"), error => error instanceof Error && !error.message.includes("private"));
  }
});

test("partial/all application is explicit and immutable; customized replacement detection preserves untouched stages", () => {
  const current = { INITIAL: { subject: "My subject", body: "My message" }, REMINDER: { subject: "Personal reminder", body: "Hi" } };
  assert.deepEqual(customizedEventAIStages(current, draft, EVENT_AI_STAGES), ["INITIAL", "REMINDER"]);
  const next = applyEventAIStages(current, draft, ["FOLLOW_UP"]);
  assert.deepEqual(next.INITIAL, current.INITIAL); assert.deepEqual(next.REMINDER, current.REMINDER); assert.deepEqual(next.FOLLOW_UP, draft.FOLLOW_UP); assert(!("FOLLOW_UP" in current));
  assert.deepEqual(applyEventAIStages(current, draft, EVENT_AI_STAGES), draft); assert.equal(current.INITIAL.subject, "My subject");
  assert.equal(validEventAIStage({ ...draft, INITIAL: { subject: " ", body: "" } }, "INITIAL"), false);
  assert.throws(() => applyEventAIStages({}, { ...draft, INITIAL: { subject: "", body: "" } }, ["INITIAL"]));
  assert.deepEqual(customizedEventAIStages(draft, draft, EVENT_AI_STAGES), []);
});

test("only the approved first-name merge field is accepted in generated copy", () => {
  assert(validEventAIStage({ ...draft, INITIAL: { subject: "Hi {{FIRST_NAME}}", body: "Hello {{FIRST_NAME}}!" } }, "INITIAL"));
  for (const body of ["Hello {{EMAIL}}", "Hi {{ first_name }}", "Hi {{FIRST_NAME", "Hi {{FIRST_NAME}} and {{LAST_NAME}}"]) assert(!validEventAIStage({ ...draft, INITIAL: { subject: "Hi", body } }, "INITIAL"));
});
