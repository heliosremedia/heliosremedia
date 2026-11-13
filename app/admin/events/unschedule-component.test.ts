/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as helpers from "./ui-helpers.ts";
import * as themes from "../../../lib/events/themes.ts";
import * as scheduling from "../../../lib/client-communications/scheduling.ts";

const baseEvent = {
  id: "holiday", title: "Holiday gathering", description: "Original wording", location: "The studio",
  startsAt: "2035-12-20T01:00:00.000Z", endsAt: "2035-12-20T03:30:00.000Z", timeZone: "America/Denver", status: "SCHEDULED", mode: "GROUPS", groupIds: ["original-group"], clientIds: [],
  templateKey: "CHRISTMAS", imageUrl: null, imageAlt: null, venueUrl: "https://example.test/venue",
  emailContent: { INITIAL: { subject: "Holiday", body: "Saved invitation wording" }, FOLLOW_UP: { subject: "Join us", body: "Saved follow-up" } },
  invitations: [{ id: "guest-1", response: "PENDING", displayName: "Saved Guest", email: "guest@example.test" }],
  deliveries: [
    { id: "initial", stage: "INITIAL", status: "SCHEDULED", scheduledAt: "2035-11-10T17:00:00.000Z", messages: [] },
    { id: "follow-up", stage: "FOLLOW_UP", status: "SCHEDULED", scheduledAt: "2035-11-24T19:00:00.000Z", messages: [] },
    { id: "reminder", stage: "REMINDER", status: "SCHEDULED", scheduledAt: "2035-12-19T01:00:00.000Z", messages: [] },
  ],
};
function mount(initial: any = baseEvent) {
  let event = structuredClone(initial), dirty = true, cursor = 0, tree: any, jobs: (() => void)[] = [];
  const slots: any[] = [], calls: { path: string; method: string; body: any }[] = [];
  const browser = { overflow: "auto", shown: 0, closed: 0, focused: "trigger" };
  class Element { isConnected = true; focus() { browser.focused = "trigger"; } }
  const document = { activeElement: new Element(), body: { style: { get overflow() { return browser.overflow; }, set overflow(value: string) { browser.overflow = value; } } } };
  const dialog = { open: false, showModal() { this.open = true; browser.shown++; }, close() { this.open = false; browser.closed++; } };
  let failNext = "", deferred: (() => void) | undefined, defer = false;
  const hooks = {
    useState(value: any) { const index = cursor++; if (!(index in slots)) slots[index] = typeof value === "function" ? value() : value; return [slots[index], (next: any) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; dirty = true; }]; },
    useRef(value: any) { const index = cursor++; if (!(index in slots)) slots[index] = { current: value }; return slots[index]; },
    useCallback(callback: any) { cursor++; return callback; },
    useEffect(effect: () => any, dependencies: any[]) { const index = cursor++, old = slots[index]; if (!old || dependencies.some((value, i) => !Object.is(value, old.dependencies[i]))) jobs.push(() => { old?.cleanup?.(); slots[index] = { dependencies, cleanup: effect() }; }); },
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const imports: any = { react: hooks, "react/jsx-runtime": { jsx, jsxs: jsx }, "./ui-helpers": helpers, "@/lib/events/themes": themes, "@/lib/client-communications/scheduling": scheduling, "./EventAppearance": {}, "./EventDraftPreview": {}, "./EventEmailCopy": {}, "./EventUpdateComposer": {}, "./ResendInvitation": {} };
  const exports: any = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("./EventStudio.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, document, HTMLElement: Element, require: (name: string) => { assert(name in imports, name); return imports[name]; },
    fetch: async (path: string, init: RequestInit) => {
      const body = init.body ? JSON.parse(String(init.body)) : undefined; calls.push({ path, method: init.method!, body });
      if (defer && init.method === "PATCH") await new Promise<void>(resolve => { deferred = resolve; });
      if (failNext && init.method !== "GET") { const error = failNext; failNext = ""; return Response.json({ error }, { status: 409 }); }
      if (path === "/api/admin/events") return Response.json({ events: [event], clients: [], groups: [{ id: "original-group", name: "Original group" }] });
      if (init.method === "PATCH") {
        if (body.action === "unschedule") { assert.equal(body.confirm, true); event.status = "DRAFT"; event.deliveries.forEach((item: any) => { if (item.status === "SCHEDULED") item.status = "PAUSED"; }); }
        else { assert.equal(event.status, "DRAFT"); event = { ...event, ...body }; }
      }
      if (path.endsWith("/email")) {
        if (body.action === "preview") return Response.json({ html: "<p>Saved preview</p>", subject: "Saved subject" });
        assert.equal(body.action, "schedule", "No tests may send real or test email"); assert.equal(body.confirm, true); event.status = "SCHEDULED";
        event.deliveries.forEach((item: any) => { if (item.status === "PAUSED") { item.status = "SCHEDULED"; item.scheduledAt = body.deliveryTimes[item.stage]; } });
      }
      return Response.json({ success: true, event });
    },
  });
  const nodes = (node: any): any[] => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : node.props?.hidden ? [] : [node, ...nodes(node.props?.children)];
  const text = (node: any): string => node == null ? "" : typeof node !== "object" ? String(node) : Array.isArray(node) ? node.map(text).join("") : node.props?.hidden ? "" : text(node.props?.children);
  const find = (type: string, matches: (node: any) => boolean = () => true) => nodes(tree).find(node => node.type === type && matches(node));
  const button = (label: string) => find("button", node => text(node) === label);
  async function settle() { for (let i = 0; i < 6; i++) { if (dirty) { cursor = 0; dirty = false; jobs = []; tree = exports.default({ defaultTestEmail: "qa@example.test" }); nodes(tree).forEach(node => { if (node.props?.ref) node.props.ref.current = node.type === "dialog" ? dialog : { focus() { browser.focused = "keep"; } }; }); jobs.forEach(job => job()); } await new Promise(resolve => setImmediate(resolve)); } }
  async function open() { await settle(); find("button", node => text(node).startsWith(event.title)).props.onClick(); await settle(); }
  const field = (label: string) => nodes(find("label", node => text(node).startsWith(label))).find(node => ["input", "textarea", "select"].includes(node.type));
  const submit = (label: string) => find("form", node => text(node).includes(label)).props.onSubmit({ preventDefault() {} });
  async function pause() { button("Unschedule & edit").props.onClick(); await settle(); button("Confirm unschedule & edit").props.onClick(); await settle(); }
  return { browser, copy: () => nodes(tree).find(node => node.props?.aiSource && node.props?.value), open, settle, pause, button, field, submit, find, calls, text: () => text(tree), event: () => structuredClone(event), fail: (error: string) => { failNext = error; }, defer: () => { defer = true; }, resolve: () => { defer = false; deferred?.(); }, unmount: () => slots.forEach(slot => slot?.cleanup?.()) };
}

test("unschedule is a separate confirmed action; keeping the schedule makes no mutation", async () => {
  const ui = mount(); await ui.open(); assert(ui.button("Unschedule & edit")); assert.equal(ui.button("Edit draft"), undefined);
  ui.button("Unschedule & edit").props.onClick(); await ui.settle(); assert.match(ui.text(), /Nothing resumes until you confirm the schedule again/);
  ui.button("Keep schedule").props.onClick(); await ui.settle(); assert.equal(ui.button("Confirm unschedule & edit"), undefined); assert(ui.calls.every(call => call.method === "GET")); ui.unmount();
});

test("confirmation opens a viewport-bounded modal and restores focus and scroll after dismissal", async () => {
  const ui = mount(); await ui.open();
  for (let attempt = 0; attempt < 2; attempt++) {
    ui.button("Unschedule & edit").props.onClick(); await ui.settle();
    const dialog = ui.find("dialog"); assert(dialog); assert.equal(dialog.props["aria-modal"], "true");
    assert.equal(dialog.props["aria-labelledby"], "unschedule-confirm-title");
    assert.match(dialog.props.className, /max-h-\[calc\(100dvh_-_2rem\)\]/);
    assert.match(dialog.props.className, /open:flex/);
    assert.equal(ui.browser.shown, attempt + 1); assert.equal(ui.browser.focused, "keep"); assert.equal(ui.browser.overflow, "hidden");
    let prevented = false; dialog.props.onCancel({ preventDefault() { prevented = true; } }); await ui.settle();
    assert(prevented); assert.equal(ui.find("dialog"), undefined); assert.equal(ui.browser.overflow, "auto"); assert.equal(ui.browser.focused, "trigger");
  }
  assert(ui.calls.every(call => call.method === "GET")); ui.unmount();
});

test("pending confirmation cannot Escape out and server errors stay inside the modal", async () => {
  const ui = mount(); await ui.open(); ui.button("Unschedule & edit").props.onClick(); await ui.settle();
  ui.fail("Delivery has already started."); ui.defer(); ui.button("Confirm unschedule & edit").props.onClick();
  // Escape in the same frame must respect the synchronous operation guard.
  ui.find("dialog").props.onCancel({ preventDefault() {} }); ui.button("Keep schedule").props.onClick(); await ui.settle(); assert(ui.find("dialog"));
  ui.resolve(); await ui.settle(); assert(ui.find("dialog")); assert.equal(ui.find("dialog").props["aria-busy"], false);
  const content = ui.find("dialog").props.children[0];
  assert(content.props.children.some((node: any) => node?.props?.role === "alert"));
  assert.equal(ui.event().status, "SCHEDULED"); assert.equal(ui.calls.filter(call => call.method === "PATCH").length, 1);
  ui.unmount(); assert.equal(ui.browser.overflow, "auto"); assert.equal(ui.browser.focused, "trigger");
});

test("pause, edit wording and event date, save, adjust all delivery times and resume the same event", async () => {
  const ui = mount(); await ui.open(); await ui.pause();
  assert.deepEqual(ui.calls.find(call => call.method === "PATCH")?.body, { action: "unschedule", confirm: true });
  assert.equal(ui.field("Description").props.value, baseEvent.description); assert.equal(ui.field("Start date").props.value, "2035-12-19T18:00");
  assert.equal(ui.find("fieldset").props.disabled, true); assert.match(ui.text(), /1 saved recipients/);
  ui.field("Description").props.onChange({ target: { value: "Updated wording" } }); ui.copy().props.onChange({ ...baseEvent.emailContent, INITIAL: { subject: "Revised invitation subject", body: "Revised invitation wording" } }); ui.field("Start date").props.onChange({ target: { value: "2035-12-19T19:00" } }); await ui.settle(); ui.submit("Save changes"); await ui.settle();
  assert.equal(ui.event().description, "Updated wording"); assert.equal(ui.event().startsAt, "2035-12-20T02:00:00.000Z"); assert.equal(ui.event().emailContent.INITIAL.body, "Revised invitation wording"); assert.equal(ui.event().emailContent.INITIAL.subject, "Revised invitation subject"); assert.deepEqual(ui.event().emailContent.FOLLOW_UP, baseEvent.emailContent.FOLLOW_UP); assert.deepEqual(ui.event().invitations, baseEvent.invitations);
  assert.equal(ui.event().status, "DRAFT"); assert.match(ui.text(), /Delivery is still paused/);
  assert.equal(ui.field("Send initial invitation at").props.value, "2035-11-10T10:00"); assert.equal(ui.field("Send follow-up at").props.value, "2035-11-24T12:00"); assert.equal(ui.field("Send day-before reminder at").props.value, "2035-12-18T18:00");
  assert.equal(ui.button("Confirm & resume schedule").props.disabled, true);
  ui.field("I have reviewed").props.onChange({ target: { checked: true } }); await ui.settle(); assert.equal(ui.button("Confirm & resume schedule").props.disabled, false);
  ui.field("Send follow-up at").props.onChange({ target: { value: "2035-11-24T14:30" } }); await ui.settle(); assert.equal(ui.button("Confirm & resume schedule").props.disabled, true);
  ui.field("I have reviewed").props.onChange({ target: { checked: true } }); await ui.settle(); ui.submit("Confirm & resume schedule"); await ui.settle();
  const scheduled = ui.calls.find(call => call.body?.action === "schedule")!; assert.equal(scheduled.path, "/api/admin/events/holiday/email"); assert.equal(scheduled.body.stage, "INITIAL");
  assert.deepEqual(scheduled.body.deliveryTimes, { INITIAL: baseEvent.deliveries[0].scheduledAt, FOLLOW_UP: "2035-11-24T21:30:00.000Z", REMINDER: baseEvent.deliveries[2].scheduledAt });
  assert.equal(ui.event().status, "SCHEDULED"); assert.equal(ui.event().id, baseEvent.id); assert.deepEqual(ui.event().groupIds, baseEvent.groupIds); assert(ui.calls.every(call => !["cancel", "test"].includes(call.body?.action))); ui.unmount();
});

test("discard, leave, reopen and preview keep delivery paused with its saved times", async () => {
  const ui = mount(); await ui.open(); await ui.pause();
  ui.field("Description").props.onChange({ target: { value: "Unsaved edit" } }); await ui.settle(); ui.button("Discard edits & return").props.onClick(); await ui.settle(); assert.match(ui.text(), /Leaving this page keeps delivery paused/); assert.doesNotMatch(ui.text(), /Unsaved edit/);
  await ui.open(); assert.equal(ui.field("Send follow-up at").props.value, "2035-11-24T12:00");
  ui.field("Email to review").props.onChange({ target: { value: "FOLLOW_UP" } }); await ui.settle(); assert.equal(ui.button("Confirm & resume schedule"), undefined);
  ui.button("Preview email").props.onClick(); await ui.settle(); assert.equal(ui.event().status, "DRAFT");
  ui.button("Review saved schedule").props.onClick(); await ui.settle(); assert(ui.button("Confirm & resume schedule"));
  assert.equal(ui.calls.filter(call => call.method === "PATCH").length, 1); assert.equal(ui.calls.filter(call => call.body?.action === "schedule").length, 0); ui.unmount();
});

test("repeated clicks submit one pause and server rejection leaves the scheduled event unchanged", async () => {
  const ui = mount(); await ui.open(); ui.button("Unschedule & edit").props.onClick(); await ui.settle();
  ui.fail("Delivery has already started."); ui.defer(); const confirm = ui.button("Confirm unschedule & edit").props.onClick; confirm(); confirm(); await ui.settle();
  assert.equal(ui.calls.filter(call => call.method === "PATCH").length, 1); assert.equal(ui.button("Keep schedule").props.disabled, true); ui.resolve(); await ui.settle();
  assert.match(ui.text(), /Delivery has already started/); assert.equal(ui.event().status, "SCHEDULED"); assert.equal(ui.button("Save changes"), undefined); ui.unmount();
});

test("cancelled, started and unknown delivery activity cannot expose the unschedule action", async () => {
  for (const event of [{ ...baseEvent, status: "CANCELLED" }, { ...baseEvent, deliveries: baseEvent.deliveries.map(item => ({ ...item, messages: [{ id: "started" }] })) }, { ...baseEvent, deliveries: baseEvent.deliveries.map(item => ({ ...item, messages: undefined })) }]) {
    const ui = mount(event); await ui.open(); assert.equal(ui.button("Unschedule & edit"), undefined); assert(ui.calls.every(call => call.method === "GET")); ui.unmount();
  }
});

test("reconfirming unchanged local times preserves the saved instant during fall-back ambiguity", async () => {
  const initial = { ...baseEvent, deliveries: [{ ...baseEvent.deliveries[0], scheduledAt: "2035-11-04T08:30:00.000Z" }] };
  const ui = mount(initial); await ui.open(); await ui.pause(); ui.button("Discard edits & return").props.onClick(); await ui.settle();
  ui.field("I have reviewed").props.onChange({ target: { checked: true } }); await ui.settle(); ui.submit("Confirm & resume schedule"); await ui.settle();
  assert.equal(ui.calls.find(call => call.body?.action === "schedule")?.body.scheduledAt, initial.deliveries[0].scheduledAt); ui.unmount();
});


test("resuming keeps previously cancelled stages cancelled and does not add them to the payload", async () => {
  const initial = { ...baseEvent, deliveries: baseEvent.deliveries.map(item => item.stage === "FOLLOW_UP" ? { ...item, status: "CANCELLED" } : item) };
  const ui = mount(initial); await ui.open(); await ui.pause(); ui.button("Discard edits & return").props.onClick(); await ui.settle();
  assert.equal(ui.field("Send follow-up at"), undefined); assert.match(ui.text(), /CANCELLED/);
  ui.field("I have reviewed").props.onChange({ target: { checked: true } }); await ui.settle(); ui.submit("Confirm & resume schedule"); await ui.settle();
  assert.deepEqual(Object.keys(ui.calls.find(call => call.body?.action === "schedule")!.body.deliveryTimes), ["INITIAL", "REMINDER"]);
  assert.deepEqual(ui.event().deliveries[1], initial.deliveries[1]); ui.unmount();
});

test("a scheduled additional update cannot expose unschedule", async () => {
  const ui = mount({ ...baseEvent, deliveries: [...baseEvent.deliveries, { id: "extra", stage: "UPDATE_extra", status: "SCHEDULED", scheduledAt: "2035-11-20T12:00:00.000Z", messages: [] }] });
  await ui.open(); assert.equal(ui.button("Unschedule & edit"), undefined); ui.unmount();
});
