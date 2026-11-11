/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as helpers from "./event-update-composer.ts";
import { displayDate } from "./ui-helpers.ts";

test("update validation, time-zone conversion and personalization enforce their limits", () => {
  const draft = { subject: "Party update", body: "Bring a guest.", audience: "ALL_INVITED" as const };
  assert.equal(helpers.eventUpdateCopyError(draft), "");
  for (const subject of ["", "x".repeat(201), "One\nTwo"]) assert.match(helpers.eventUpdateCopyError({ ...draft, subject }), /subject/);
  for (const body of ["", " ", "x".repeat(3001)]) assert.match(helpers.eventUpdateCopyError({ ...draft, body }), /message/);
  assert.match(helpers.eventUpdateCopyError({ ...draft, audience: "" }), /Choose/);
  const event = { startsAt: "2035-12-20T22:00:00Z", timeZone: "America/Denver" };
  assert.equal(helpers.eventUpdateSendTime("2035-12-18T12:30", event, +new Date("2035-12-01")), "2035-12-18T19:30:00.000Z");
  assert.throws(() => helpers.eventUpdateSendTime("2035-12-21T12:30", event, 0), /before/);
  assert.throws(() => helpers.eventUpdateSendTime("2035-12-18T12:30", event, +new Date("2035-12-18T19:30:00Z")), /minute/);
  assert.deepEqual(helpers.insertUpdateFirstName("Hello Ada!", "body", 6, 9), { text: "Hello {{FIRST_NAME}}!", caret: 20 });
  assert.match(helpers.insertUpdateFirstName("x".repeat(2990), "body").error!, /3,000/);
  assert.match(helpers.insertUpdateFirstName("x".repeat(200), "subject").error!, /200/);
});

test("unchanged retries retain their ID while every scheduling field changes identity", () => {
  let count = 0;
  const key = helpers.createEventUpdateRequestKey(() => `request-${++count}`);
  const payload = { eventId: "party", subject: "Update", body: "Message", audience: "YES" as const, scheduledAt: "2035-12-01T12:00:00Z" };
  assert.equal(key.forPayload(payload), "request-1");
  assert.equal(key.forPayload({ ...payload }), "request-1");
  for (const patch of [{ eventId: "other" }, { subject: "New" }, { body: "New" }, { audience: "ALL_INVITED" as const }, { scheduledAt: "2035-12-02T12:00:00Z" }]) {
    const before = count;
    key.forPayload({ ...payload, ...patch }); assert.equal(count, before + 1);
  }
});

const originals = ["INITIAL", "FOLLOW_UP", "REMINDER"].map((stage, index) => ({ id: stage, stage, status: "SCHEDULED", scheduledAt: `2035-12-${index + 10}T12:00:00Z` }));
const queued = { id: "update-queued", stage: "UPDATE_queued", status: "SCHEDULED", scheduledAt: "2035-12-15T12:00:00Z", updateSubject: "Guest count note", updateBody: "Tell us your party size.", updateAudience: "ALL_INVITED" };
const completed = { ...queued, id: "update-complete", stage: "UPDATE_complete", status: "COMPLETED", updateSubject: "Previous note" };
const baseEvent = { id: "party", title: "Holiday gathering", status: "SCHEDULED", startsAt: "2035-12-20T18:00:00Z", timeZone: "UTC", deliveries: [...originals, queued, completed] };

function mount(initialEvent = baseEvent) {
  let event = initialEvent, disabled = false, cursor = 0, dirty = true, tree: any, jobs: (() => void)[] = [], uuidCount = 0;
  const slots: any[] = [], changes: any[] = [];
  const calls: { path: string; body: any; resolve: (response: Response) => void; reject: (error: Error) => void }[] = [];
  const elements = {
    subject: { selectionStart: null, selectionEnd: null, focus() {}, setSelectionRange() {} },
    body: { selectionStart: null, selectionEnd: null, focus() {}, setSelectionRange() {} },
  };
  function effect(effect: () => any, dependencies: any[]) {
    const index = cursor++, previous = slots[index];
    if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) jobs.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: effect() }; });
  }
  const hooks = {
    useState(initial: any) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], (value: any) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; dirty = true; }]; },
    useRef(initial: any) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useEffect: effect, useLayoutEffect: effect,
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const imports: any = { react: hooks, "react/jsx-runtime": { jsx, jsxs: jsx }, "./ui-helpers": { displayDate }, "./event-update-composer": helpers };
  const exports: any = {};
  const source = ts.transpileModule(readFileSync(new URL("./EventUpdateComposer.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, {
    exports, Error, require: (name: string) => { assert(name in imports, `Unexpected import ${name}`); return imports[name]; },
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuidCount).padStart(12, "0")}` },
    fetch: (path: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
      assert.equal(init.method, "POST"); assert.equal(init.cache, "no-store");
      calls.push({ path, body: JSON.parse(String(init.body)), resolve, reject });
    }),
  });
  const nodes = (node: any, includeHidden = false): any[] => !node || typeof node !== "object" || (!includeHidden && node.props?.hidden) ? [] : Array.isArray(node) ? node.flatMap(child => nodes(child, includeHidden)) : [node, ...nodes(node.props?.children, includeHidden)];
  const text = (node: any): string => node == null || node.props?.hidden ? "" : typeof node !== "object" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);
  function render() {
    cursor = 0; dirty = false; jobs = [];
    tree = exports.default({ event, defaultTestEmail: "owner@example.test", disabled, onEventChange: (next: any) => { event = next; changes.push(next); dirty = true; } });
    for (const node of nodes(tree, true)) if (node.props?.ref) node.props.ref.current = node.type === "textarea" ? elements.body : elements.subject;
    for (const job of jobs) job();
  }
  async function settle() { for (let count = 0; count < 8; count++) { if (dirty) render(); await new Promise(resolve => setImmediate(resolve)); } }
  const find = (type: string, match: (node: any) => boolean = () => true) => nodes(tree).find(node => node.type === type && match(node));
  const button = (label: string) => find("button", node => text(node) === label);
  const toggle = () => find("button", node => typeof node.props["aria-expanded"] === "boolean");
  const panel = () => nodes(tree, true).find(node => node.props?.id === toggle().props["aria-controls"]);
  async function open() { await settle(); if (!toggle().props["aria-expanded"]) { toggle().props.onClick(); await settle(); } }
  const change = (node: any, value: string) => node.props.onChange({ target: { value } });
  async function fill() {
    await open(); change(find("select"), "ALL_INVITED"); await settle();
    change(find("textarea"), "Hi {{FIRST_NAME}}, please update your party size."); await settle();
    change(find("input", node => node.props.type === "datetime-local"), "2035-12-15T13:00"); await settle();
  }
  async function preview() {
    button("Preview update").props.onClick(); await settle();
    calls.at(-1)!.resolve(Response.json({ success: true, subject: "Hi Alex", html: '<p>Update</p><a href="https://example.test/private-rsvp">RSVP</a><a href=\'https://example.test\'>Venue</a>', audienceCount: 2 })); await settle();
  }
  async function confirm() { find("input", node => node.props.type === "checkbox").props.onChange({ target: { checked: true } }); await settle(); }
  const submit = (index: number) => nodes(tree).filter(node => node.type === "form")[index].props.onSubmit({ preventDefault() {} });
  return { settle, open, toggle, panel, find, button, change, fill, preview, confirm, submit, calls, changes, allText: () => text(tree), mountedNodes: () => nodes(tree, true), disable: () => { disabled = true; dirty = true; }, unmount: () => { for (const slot of slots) slot?.cleanup?.(); } };
}

test("composer starts inert, requires an explicit audience, and keeps update history separate", async () => {
  const ui = mount(); await ui.open();
  assert.equal(ui.calls.length, 0); assert.equal(ui.find("select").props.value, "");
  assert.equal(ui.button("Preview update").props.disabled, true);
  assert.equal(ui.button("Confirm & schedule update").props.disabled, true);
  assert.match(ui.allText(), /Guest count note/); assert.match(ui.allText(), /Previous note/);
  assert.doesNotMatch(ui.allText(), /INITIAL|FOLLOW_UP|REMINDER/);
  ui.find("button", node => node.props["aria-label"] === "Insert first name into update message").props.onClick(); await ui.settle();
  assert.equal(ui.find("textarea").props.value, "{{FIRST_NAME}}"); assert.equal(ui.calls.length, 0);
  ui.unmount();
});

test("manual preview is inert and double-click safe; responsive controls never send", async () => {
  const ui = mount(); await ui.fill();
  const preview = ui.button("Preview update").props.onClick; preview(); preview(); await ui.settle();
  assert.equal(ui.calls.length, 1); assert.equal(ui.calls[0].body.action, "preview");
  assert.equal(ui.calls[0].body.confirm, undefined); assert.equal(ui.calls[0].body.scheduledAt, undefined);
  assert.equal(ui.find("fieldset").props.disabled, true);
  ui.calls[0].resolve(Response.json({ success: true, subject: "Hi Alex", html: '<a href="https://example.test">RSVP</a><a href=https://example.test>Link</a>', audienceCount: 2 })); await ui.settle();
  const frame = ui.find("iframe"); assert.equal(frame.props.sandbox, ""); assert.equal(frame.props.referrerPolicy, "no-referrer");
  assert.doesNotMatch(frame.props.srcDoc, /href=/); assert.match(frame.props.srcDoc, /Content-Security-Policy/);
  ui.button("Mobile").props.onClick(); await ui.settle(); assert.equal(ui.find("iframe").props.style.maxWidth, 375);
  ui.button("Desktop").props.onClick(); await ui.settle(); assert.equal(ui.find("iframe").props.style.maxWidth, 760);
  await ui.confirm(); assert.equal(ui.button("Confirm & schedule update").props.disabled, false);
  ui.change(ui.find("textarea"), "Changed content"); await ui.settle();
  assert.equal(ui.find("iframe"), undefined); assert.equal(ui.find("input", node => node.props.type === "checkbox").props.checked, false);
  assert.equal(ui.calls.length, 1); ui.unmount();
});

test("test emails require a manual submit and never schedule or change the original plan", async () => {
  const ui = mount(); await ui.fill();
  assert.equal(ui.calls.length, 0); ui.submit(0); ui.submit(0); await ui.settle();
  assert.equal(ui.calls.length, 1); assert.equal(ui.calls[0].body.action, "test"); assert.equal(ui.calls[0].body.confirm, true);
  assert.equal(ui.calls[0].body.testEmail, "owner@example.test"); assert.equal(ui.calls[0].body.requestId, undefined);
  ui.calls[0].resolve(Response.json({ success: true, message: "Test sent. RSVP is disabled." })); await ui.settle();
  assert.match(ui.allText(), /Test sent/); assert.equal(ui.changes.length, 0); ui.unmount();
});

test("scheduling requires preview and confirmation, guards duplicates and preserves uncertain retry identity", async () => {
  const ui = mount(); await ui.fill(); ui.submit(1); await ui.settle(); assert.equal(ui.calls.length, 0);
  await ui.preview(); await ui.confirm(); ui.submit(1); ui.submit(1); await ui.settle();
  assert.equal(ui.calls.length, 2); const first = ui.calls[1].body;
  assert.equal(first.action, "schedule"); assert.equal(first.confirm, true); assert.equal(first.audience, "ALL_INVITED");
  assert.equal(first.scheduledAt, "2035-12-15T13:00:00.000Z"); assert.match(first.requestId, /^00000000-/);
  ui.calls[1].reject(new Error("Lost connection")); await ui.settle();
  assert.match(ui.allText(), /Retrying the unchanged schedule/); ui.submit(1); await ui.settle();
  assert.equal(ui.calls[2].body.requestId, first.requestId);
  const next = { ...baseEvent, deliveries: [...baseEvent.deliveries, { ...queued, id: "new-update" }] };
  ui.calls[2].resolve(Response.json({ success: true, event: next })); await ui.settle();
  assert.equal(ui.changes.length, 1); assert.deepEqual(ui.changes[0].deliveries.slice(0, 3), originals);
  assert.equal(ui.button("Update scheduled").props.disabled, true); ui.submit(1); await ui.settle(); assert.equal(ui.calls.length, 3);
  ui.change(ui.find("input", node => node.props.type === "datetime-local"), "2035-12-15T14:00"); await ui.settle();
  assert.equal(ui.find("input", node => node.props.type === "checkbox").props.checked, false);
  await ui.confirm(); ui.submit(1); await ui.settle(); assert.notEqual(ui.calls[3].body.requestId, first.requestId);
  ui.calls[3].resolve(Response.json({ success: true, event: next })); await ui.settle(); ui.unmount();
});

test("only pending updates can be cancelled, and keep/dismiss never mutate", async () => {
  const ui = mount(); await ui.open();
  ui.button("Cancel pending update").props.onClick(); await ui.settle(); assert.equal(ui.calls.length, 0);
  ui.button("Keep update").props.onClick(); await ui.settle(); assert.equal(ui.button("Confirm cancellation"), undefined);
  ui.button("Cancel pending update").props.onClick(); await ui.settle();
  const confirm = ui.button("Confirm cancellation").props.onClick; confirm(); confirm(); await ui.settle();
  assert.equal(ui.calls.length, 1); assert.deepEqual(ui.calls[0].body, { action: "cancel", deliveryId: queued.id, confirm: true });
  ui.calls[0].resolve(Response.json({ success: true, event: { ...baseEvent, deliveries: baseEvent.deliveries.map(delivery => delivery.id === queued.id ? { ...delivery, status: "CANCELLED" } : delivery) } })); await ui.settle();
  assert.equal(ui.button("Cancel pending update"), undefined); assert.equal(ui.button("Confirm cancellation"), undefined);
  assert.deepEqual(ui.changes[0].deliveries.slice(0, 3), originals); ui.unmount();
});

test("zero audiences, cancelled events, stale unmounted responses and parent locks cannot send", async () => {
  const empty = mount(); await empty.fill(); empty.button("Preview update").props.onClick(); await empty.settle();
  empty.calls[0].resolve(Response.json({ success: true, subject: "Update", html: "<p>Update</p>", audienceCount: 0 })); await empty.settle();
  assert.match(empty.allText(), /No eligible recipients/); await empty.confirm(); empty.submit(1); await empty.settle(); assert.equal(empty.calls.length, 1); empty.unmount();
  const cancelled = mount({ ...baseEvent, status: "CANCELLED" }); await cancelled.open();
  assert.equal(cancelled.button("Preview update"), undefined); assert.equal(cancelled.button("Cancel pending update"), undefined); assert.match(cancelled.allText(), /Guest count note/); cancelled.unmount();
  const late = mount(); await late.fill(); await late.preview(); await late.confirm(); late.submit(1); await late.settle(); late.unmount();
  late.calls[1].resolve(Response.json({ success: true, event: baseEvent })); await late.settle(); assert.equal(late.changes.length, 0);
  const locked = mount(); await locked.fill(); locked.disable(); await locked.settle(); locked.button("Preview update").props.onClick(); locked.submit(0); await locked.settle(); assert.equal(locked.calls.length, 0); locked.unmount();
});

test("additional follow-up starts collapsed with native keyboard semantics and mounted, hidden controls", async () => {
  const ui = mount(); await ui.settle();
  assert.equal(ui.toggle().type, "button"); assert.equal(ui.toggle().props.type, "button");
  assert.equal(ui.toggle().props["aria-expanded"], false); assert.equal(ui.panel().props.hidden, true);
  assert.equal(ui.toggle().props["aria-controls"], ui.panel().props.id);
  assert.equal(ui.toggle().props.onKeyDown, undefined, "Native Enter/Space activation is not overridden");
  assert.equal(ui.toggle().props.tabIndex, undefined, "Native button remains keyboard-focusable");
  assert.equal(ui.find("select"), undefined); assert.equal(ui.find("textarea"), undefined);
  assert.equal(ui.button("Send update test only"), undefined); assert.equal(ui.button("Confirm & schedule update"), undefined);
  assert(ui.mountedNodes().some(node => node.type === "textarea"), "Hidden fields remain mounted rather than being discarded");
  assert.match(ui.allText(), /2 updates in history/);
  assert.equal(ui.calls.length, 0); assert.equal(ui.changes.length, 0);
  await ui.open();
  assert.equal(ui.toggle().props["aria-expanded"], true); assert.equal(ui.panel().props.hidden, false); assert(ui.find("textarea"));
  ui.toggle().props.onClick(); await ui.settle();
  assert.equal(ui.panel().props.hidden, true); assert.equal(ui.calls.length, 0); ui.unmount();
});

test("collapse and reopen preserve the entire draft, preview, confirmation and cancellation choice without actions", async () => {
  const ui = mount(); await ui.fill();
  ui.change(ui.find("input", node => node.props.maxLength === 200), "My edited update subject"); await ui.settle();
  ui.change(ui.find("input", node => node.props.type === "email"), "reviewer@example.test"); await ui.settle();
  await ui.preview(); ui.button("Mobile").props.onClick(); await ui.settle(); await ui.confirm();
  ui.button("Cancel pending update").props.onClick(); await ui.settle();
  for (let count = 0; count < 3; count++) {
    ui.toggle().props.onClick(); await ui.settle();
    assert.equal(ui.find("textarea"), undefined); assert.equal(ui.find("iframe"), undefined);
    assert.equal(ui.mountedNodes().find(node => node.type === "textarea").props.value, "Hi {{FIRST_NAME}}, please update your party size.");
    await ui.open();
    assert.equal(ui.find("select").props.value, "ALL_INVITED");
    assert.equal(ui.find("input", node => node.props.maxLength === 200).props.value, "My edited update subject");
    assert.equal(ui.find("textarea").props.value, "Hi {{FIRST_NAME}}, please update your party size.");
    assert.equal(ui.find("input", node => node.props.type === "email").props.value, "reviewer@example.test");
    assert.equal(ui.find("input", node => node.props.type === "datetime-local").props.value, "2035-12-15T13:00");
    assert.equal(ui.find("iframe").props.style.maxWidth, 375);
    assert.equal(ui.find("input", node => node.props.type === "checkbox").props.checked, true);
    assert(ui.button("Confirm cancellation"));
    assert.equal(ui.calls.length, 1); assert.equal(ui.changes.length, 0);
  }
  ui.unmount();
});

test("preview completes while collapsed without reopening or clearing the draft", async () => {
  const ui = mount(); await ui.fill(); ui.button("Preview update").props.onClick(); await ui.settle();
  ui.toggle().props.onClick(); await ui.settle();
  assert.equal(ui.toggle().props["aria-expanded"], false); assert.match(ui.allText(), /Loading update preview/);
  ui.calls[0].resolve(Response.json({ success: true, subject: "Ready", html: "<p>Preview</p>", audienceCount: 2 })); await ui.settle();
  assert.equal(ui.toggle().props["aria-expanded"], false); assert.doesNotMatch(ui.allText(), /Loading update preview/);
  await ui.open(); assert(ui.find("iframe")); assert.equal(ui.find("textarea").props.value, "Hi {{FIRST_NAME}}, please update your party size.");
  assert.equal(ui.calls.length, 1); assert.equal(ui.changes.length, 0); ui.unmount();
});

test("errors and completion messages stay visible while collapsed and survive toggles", async () => {
  const ui = mount(); await ui.fill(); ui.button("Preview update").props.onClick(); await ui.settle();
  ui.toggle().props.onClick(); await ui.settle();
  ui.calls[0].reject(new Error("Preview unavailable")); await ui.settle();
  assert.match(ui.find("p", node => node.props.role === "alert").props.children, /Preview unavailable/);
  await ui.open(); ui.toggle().props.onClick(); await ui.settle(); assert.match(ui.allText(), /Preview unavailable/);
  await ui.open(); ui.submit(0); await ui.settle(); ui.toggle().props.onClick(); await ui.settle();
  assert.match(ui.allText(), /Sending update test/);
  ui.calls[1].resolve(Response.json({ success: true, message: "Synthetic test completed." })); await ui.settle();
  assert.equal(ui.toggle().props["aria-expanded"], false); assert.match(ui.allText(), /Synthetic test completed/);
  assert.equal(ui.calls.length, 2); assert.equal(ui.changes.length, 0); ui.unmount();
});

test("read-only toggling remains available under parent locks and panel IDs are event-specific", async () => {
  const ui = mount(); await ui.settle(); ui.disable(); await ui.settle();
  assert.equal(ui.toggle().props.disabled, undefined); await ui.open();
  assert.equal(ui.find("fieldset").props.disabled, true); ui.toggle().props.onClick(); await ui.settle();
  assert.equal(ui.panel().props.hidden, true); assert.equal(ui.calls.length, 0);
  const other = mount({ ...baseEvent, id: "another-event" }); await other.settle();
  assert.notEqual(ui.panel().props.id, other.panel().props.id);
  ui.unmount(); other.unmount();
});
