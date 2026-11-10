/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as contract from "../../../lib/events/ai-contract.ts";
import * as writer from "./ai-writing.ts";
import { createEventForm, type EventEditorForm } from "./ui-helpers.ts";

function mount(initial: EventEditorForm) {
  let form = initial, cursor = 0, dirty = true, tree: any, jobs: (() => void)[] = [], confirmations = 0, approve = true;
  const slots: any[] = [], applied: any[] = [], calls: { body: any; signal: AbortSignal; resolve: (response: Response) => void }[] = [];
  const hooks = {
    useState(initial: any) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], (next: any) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; dirty = true; }]; },
    useRef(initial: any) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useEffect(effect: () => any, dependencies: any[]) { const index = cursor++, previous = slots[index]; if (!previous || dependencies.some((dependency, i) => !Object.is(dependency, previous.dependencies[i]))) jobs.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: effect() }; }); },
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const imports: any = { react: hooks, "react/jsx-runtime": { jsx, jsxs: jsx }, "@/lib/events/ai-contract": contract,
    "./ai-writing": { ...writer, createEventAIWriter: () => writer.createEventAIWriter(async (url, init) => { assert.equal(url, "/api/admin/events/ai", "No send/save/schedule calls"); return new Promise(resolve => calls.push({ body: JSON.parse(String(init?.body)), signal: init?.signal as AbortSignal, resolve })); }) } };
  const exports: any = {};
  const js = ts.transpileModule(readFileSync(new URL("./EventAIWriter.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(js, { exports, require: (name: string) => { assert(name in imports, `Unexpected import ${name}`); return imports[name]; }, window: { confirm: () => { confirmations++; return approve; } }, Error });
  function nodes(node: any, includeHidden = false): any[] { return !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(child => nodes(child, includeHidden)) : !includeHidden && node.props?.hidden ? [] : [node, ...nodes(node.props?.children, includeHidden)]; }
  const text = (node: any): string => node == null ? "" : typeof node !== "object" ? String(node) : Array.isArray(node) ? node.map(text).join("") : node.props?.hidden ? "" : text(node.props?.children);
  function render() { cursor = 0; dirty = false; jobs = []; tree = exports.default({ source: form, value: form.emailContent, disabled: false, onChange: (value: any) => { applied.push(value); form = { ...form, emailContent: value }; dirty = true; } }); for (const job of jobs) job(); }
  async function settle() { for (let count = 0; count < 6; count++) { if (dirty) render(); await new Promise(resolve => setImmediate(resolve)); } }
  const find = (type: string, matches: (node: any) => boolean = () => true) => nodes(tree).find(node => node.type === type && matches(node));
  const button = (label: string) => find("button", node => text(node) === label);
  const toggle = () => find("button", node => typeof node.props["aria-expanded"] === "boolean");
  const panel = () => nodes(tree, true).find(node => node.props?.id === toggle().props["aria-controls"]);
  async function open() { await settle(); if (!toggle().props["aria-expanded"]) { toggle().props.onClick(); await settle(); } }
  return { settle, open, toggle, panel, find, button, calls, applied, allText: () => text(tree), confirm: (value: boolean) => { approve = value; }, confirmations: () => confirmations, update: (fields: Partial<EventEditorForm>) => { form = { ...form, ...fields }; dirty = true; }, unmount: () => { for (const slot of slots) slot?.cleanup?.(); dirty = false; } };
}
const form = { ...createEventForm(), title: "Unsaved party", description: "Together at the studio.", startsAt: "2030-12-15T18:00", clientIds: ["private-id"], emailContent: { INITIAL: { subject: "My personal subject", body: "My personal invitation" } } };
const draft = Object.fromEntries(contract.EVENT_AI_STAGES.map(stage => [stage, { subject: `${stage} subject`, body: `${stage} message` }]));
const response = () => Response.json({ success: true, draft });
async function ready() { const ui = mount(form); await ui.open(); ui.button("Generate all three emails").props.onClick(); await ui.settle(); ui.calls[0].resolve(response()); await ui.settle(); return ui; }

test("actual component waits for Generate, discloses data sharing and reviews editable copy without saving", async () => {
  const ui = mount(form); await ui.open(); assert.equal(ui.calls.length, 0); assert.match(ui.allText(), /OpenAI/); assert.match(ui.allText(), /Guest lists and existing email copy are not included/);
  ui.button("Generate all three emails").props.onClick(); await ui.settle(); assert.equal(ui.calls.length, 1); assert(!JSON.stringify(ui.calls[0].body).includes("private-id")); assert.equal(ui.applied.length, 0);
  ui.calls[0].resolve(response()); await ui.settle(); assert.equal(ui.applied.length, 0);
  ui.find("textarea", node => node.props["aria-label"] === "14-day follow-up suggested message").props.onChange({ target: { value: "My edited suggestion" } }); await ui.settle();
  ui.button("Apply 14-day follow-up").props.onClick(); await ui.settle(); assert.equal(ui.confirmations(), 0); assert.equal(ui.applied[0].FOLLOW_UP.body, "My edited suggestion"); assert.equal(ui.applied[0].INITIAL.subject, "My personal subject"); assert.equal(ui.calls.length, 1); assert.match(ui.allText(), /Choose Save draft/);
  ui.unmount();
});

test("customized replacement requires approval; refusal and discard leave current copy unchanged", async () => {
  const ui = await ready(); ui.confirm(false); ui.button("Apply all three emails").props.onClick(); await ui.settle(); assert.equal(ui.confirmations(), 1); assert.equal(ui.applied.length, 0);
  ui.confirm(true); ui.button("Apply all three emails").props.onClick(); await ui.settle(); assert.equal(ui.confirmations(), 2); assert.deepEqual(ui.applied[0], draft); assert.equal(ui.calls.length, 1);
  ui.button("Discard suggestions").props.onClick(); await ui.settle(); assert.equal(ui.applied.length, 1); assert.equal(ui.button("Apply all three emails"), undefined); ui.unmount();
});

test("cancel and event unmount abort requests and ignore late output", async () => {
  for (const unmount of [false, true]) {
    const ui = mount(form); await ui.open(); ui.button("Generate all three emails").props.onClick(); await ui.settle();
    if (unmount) ui.unmount(); else ui.button("Cancel generation").props.onClick();
    assert.equal(ui.calls[0].signal.aborted, true); ui.calls[0].resolve(response()); await ui.settle(); assert.equal(ui.applied.length, 0); assert.equal(ui.button("Apply all three emails"), undefined); if (!unmount) ui.unmount();
  }
});

test("source changes invalidate suggestions and cancel pending work, including changing back to original values", async () => {
  const ui = await ready(); ui.update({ title: "Changed event" }); await ui.settle(); assert.match(ui.allText(), /Event details or tone changed/); assert.equal(ui.button("Apply all three emails").props.disabled, true);
  ui.button("Apply all three emails").props.onClick(); assert.equal(ui.applied.length, 0); ui.unmount();
  const pending = mount(form); await pending.open(); pending.button("Generate all three emails").props.onClick(); await pending.settle();
  pending.update({ title: "New details" }); await pending.settle(); assert.equal(pending.calls[0].signal.aborted, true);
  pending.update({ title: form.title }); await pending.settle(); assert.equal(pending.button("Generate all three emails").props.disabled, false); assert.equal(pending.button("Writing three emails…"), undefined);
  pending.calls[0].resolve(response()); await pending.settle(); assert.equal(pending.button("Apply all three emails"), undefined); pending.unmount();
});

test("regenerate confirmation preserves edits on refusal; latest request and tone win", async () => {
  const ui = await ready(); ui.confirm(false); ui.button("Generate again").props.onClick(); await ui.settle(); assert.equal(ui.calls.length, 1);
  ui.confirm(true); ui.button("Generate again").props.onClick(); await ui.settle(); assert.equal(ui.calls.length, 2);
  ui.find("select").props.onChange({ target: { value: "Festive and upbeat" } }); await ui.settle(); assert.equal(ui.calls[1].signal.aborted, true);
  ui.button("Generate again").props.onClick(); await ui.settle(); assert.equal(ui.calls.length, 3); assert.equal(ui.calls[2].body.tone, "Festive and upbeat");
  ui.calls[2].resolve(response()); await ui.settle(); ui.calls[1].resolve(Response.json({ success: true, draft: { ...draft, INITIAL: { subject: "Stale", body: "Old" } } })); await ui.settle();
  assert.equal(ui.find("input", node => node.props["aria-label"] === "Initial invitation suggested subject").props.value, "INITIAL subject"); ui.unmount();
});

test("blank edited suggestions cannot be applied and no action button submits the parent event form", async () => {
  const ui = await ready(); ui.find("input", node => node.props["aria-label"] === "Initial invitation suggested subject").props.onChange({ target: { value: "" } }); await ui.settle();
  assert.equal(ui.button("Apply initial invitation").props.disabled, true); assert.equal(ui.button("Apply all three emails").props.disabled, true); assert.equal(ui.button("Apply 14-day follow-up").props.disabled, false);
  for (const label of ["Apply initial invitation", "Apply all three emails", "Generate again", "Discard suggestions"]) assert.equal(ui.button(label).props.type, "button"); ui.unmount();
});


test("same-tick repeated Generate clicks start only one request", async () => {
  const ui = mount(form); await ui.open();
  const generate = ui.button("Generate all three emails").props.onClick;
  generate(); generate(); generate(); await ui.settle();
  assert.equal(ui.calls.length, 1); assert.equal(ui.calls[0].signal.aborted, false);
  ui.button("Cancel generation").props.onClick(); await ui.settle();
  ui.button("Generate all three emails").props.onClick(); await ui.settle(); assert.equal(ui.calls.length, 2);
  ui.calls[1].resolve(response()); await ui.settle(); ui.calls[0].resolve(response()); await ui.settle();
  assert.equal(ui.button("Apply all three emails").props.disabled, false); ui.unmount();
});


test("AI section starts collapsed with native keyboard button semantics and hidden controls", async () => {
  const ui = mount(form); await ui.settle();
  assert.equal(ui.toggle().type, "button"); assert.equal(ui.toggle().props.type, "button");
  assert.equal(ui.toggle().props["aria-expanded"], false); assert.equal(ui.panel().props.hidden, true);
  assert.equal(ui.toggle().props["aria-controls"], ui.panel().props.id);
  assert.equal(ui.toggle().props.onKeyDown, undefined, "Native Enter/Space activation is not overridden");
  assert.equal(ui.toggle().props.tabIndex, undefined, "Native button remains in the keyboard tab order");
  assert.equal(ui.button("Generate all three emails"), undefined); assert.equal(ui.find("select"), undefined); assert.equal(ui.calls.length, 0);
  ui.toggle().props.onClick(); await ui.settle();
  assert.equal(ui.toggle().props["aria-expanded"], true); assert.equal(ui.panel().props.hidden, false); assert(ui.button("Generate all three emails"));
  ui.toggle().props.onClick(); await ui.settle();
  assert.equal(ui.toggle().props["aria-expanded"], false); assert.equal(ui.panel().props.hidden, true); assert.equal(ui.calls.length, 0); assert.equal(ui.applied.length, 0); ui.unmount();
});

test("collapse and reopen preserve tone and edited suggestions without generating, applying or saving", async () => {
  const ui = mount(form); await ui.open();
  ui.find("select").props.onChange({ target: { value: "Festive and upbeat" } }); await ui.settle();
  ui.button("Generate all three emails").props.onClick(); await ui.settle(); ui.calls[0].resolve(response()); await ui.settle();
  ui.find("textarea", node => node.props["aria-label"] === "14-day follow-up suggested message").props.onChange({ target: { value: "Keep this edited suggestion" } }); await ui.settle();
  ui.toggle().props.onClick(); await ui.settle();
  assert.match(ui.allText(), /Three email suggestions available/); assert.equal(ui.find("textarea"), undefined);
  await ui.open();
  assert.equal(ui.find("select").props.value, "Festive and upbeat");
  assert.equal(ui.find("textarea", node => node.props["aria-label"] === "14-day follow-up suggested message").props.value, "Keep this edited suggestion");
  assert.equal(ui.calls.length, 1); assert.equal(ui.applied.length, 0); assert.equal(ui.confirmations(), 0); ui.unmount();
});

test("generation continues while collapsed and completed output remains collapsed until requested", async () => {
  const ui = mount(form); await ui.open(); ui.button("Generate all three emails").props.onClick(); await ui.settle();
  ui.toggle().props.onClick(); await ui.settle();
  assert.equal(ui.calls[0].signal.aborted, false); assert.match(ui.allText(), /Writing three emails/); assert.equal(ui.button("Cancel generation"), undefined);
  ui.calls[0].resolve(response()); await ui.settle();
  assert.equal(ui.toggle().props["aria-expanded"], false); assert.match(ui.allText(), /Three email suggestions available/); assert.equal(ui.calls.length, 1); assert.equal(ui.applied.length, 0);
  await ui.open(); assert(ui.button("Apply all three emails")); assert.equal(ui.calls.length, 1); ui.unmount();
});

test("collapsed errors and stale suggestions remain available and do not clear on toggle", async () => {
  const failed = mount(form); await failed.open(); failed.button("Generate all three emails").props.onClick(); await failed.settle();
  failed.toggle().props.onClick(); await failed.settle(); failed.calls[0].resolve(Response.json({ success: false }, { status: 503 })); await failed.settle();
  assert.match(failed.allText(), /AI writing needs attention/); assert.equal(failed.toggle().props["aria-expanded"], false);
  await failed.open(); assert.match(failed.find("p", node => node.props.role === "alert").props.children, /temporarily unavailable/);
  failed.toggle().props.onClick(); await failed.settle(); await failed.open(); assert(failed.find("p", node => node.props.role === "alert")); assert.equal(failed.calls.length, 1); failed.unmount();
  const stale = await ready(); stale.toggle().props.onClick(); await stale.settle(); stale.update({ title: "Revised event" }); await stale.settle();
  assert.match(stale.allText(), /Suggestions need refreshing/); await stale.open(); assert.equal(stale.button("Apply all three emails").props.disabled, true); assert.equal(stale.applied.length, 0); stale.unmount();
});
