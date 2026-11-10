/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as themes from "../../../lib/events/themes.ts";
import * as preview from "./draft-preview.ts";
import { createEventForm, type EventEditorForm } from "./ui-helpers.ts";

// Exercise the real component's state/effect/event wiring without a DOM/browser dependency.
// Browser-native focus trapping and iframe Escape behavior still require browser QA.
function mount(form: EventEditorForm) {
  const slots: any[] = [];
  let cursor = 0, dirty = true, tree: any;
  let jobs: (() => void)[] = [];
  let closed = 0, focused = 0, restored = 0, shown = 0, hidden = 0;
  const applied: string[] = [];
  const calls: { body: any; signal: AbortSignal; resolve: (response: Response) => void }[] = [];
  class Element { focus() { restored++; } }
  const document = { activeElement: new Element(), body: { style: { overflow: "auto" } } };
  const dialog = { open: false, showModal() { this.open = true; shown++; }, close() { this.open = false; hidden++; } };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const hooks = {
    useState(initial: any) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next: any) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; dirty = true; }];
    },
    useRef(initial: any) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useEffect(effect: () => any, dependencies: any[]) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((dependency, i) => !Object.is(dependency, previous.dependencies[i]))) {
        jobs.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, effect, cleanup: effect() }; });
      }
    },
  };
  const exports: any = {};
  const source = readFileSync(new URL("./EventDraftPreview.tsx", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const imports: any = {
    react: hooks, "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "@/lib/events/themes": themes,
    "./draft-preview": { ...preview, createDraftPreviewLoader: () => preview.createDraftPreviewLoader(async (_url, init) => new Promise<Response>(resolve => calls.push({ body: JSON.parse(String(init!.body)), signal: init!.signal as AbortSignal, resolve }))) },
  };
  vm.runInNewContext(js, { exports, require: (name: string) => { assert(name in imports, `Unexpected component import ${name}`); return imports[name]; }, document, HTMLElement: Element }, { filename: "EventDraftPreview.tsx" });
  function nodes(node: any): any[] { return !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]; }
  function render() {
    cursor = 0; dirty = false; jobs = [];
    tree = exports.default({ form, onClose: () => { closed++; }, onApplyStyle: (style: string) => applied.push(style) });
    for (const node of nodes(tree)) if (node.props?.ref) node.props.ref.current = node.type === "dialog" ? dialog : { focus() { focused++; } };
    for (const job of jobs) job();
  }
  async function settle() {
    for (let count = 0; count < 6; count++) { if (dirty) render(); await new Promise(resolve => setImmediate(resolve)); }
  }
  function unmount() { for (const slot of slots) slot?.cleanup?.(); }
  function replayEffects() {
    for (const slot of slots) slot?.cleanup?.();
    for (const slot of slots) if (slot?.effect) slot.cleanup = slot.effect();
  }
  const text = (node: any): string => node == null ? "" : typeof node !== "object" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);
  const find = (type: string, matches: (node: any) => boolean = () => true) => nodes(tree).find(node => node.type === type && matches(node));
  const button = (label: string) => find("button", node => text(node) === label);
  return { settle, unmount, replayEffects, find, button, calls, applied, document, stats: () => ({ closed, focused, restored, shown, hidden }) };
}

const form = { ...createEventForm(), title: "Unsaved party", description: "An evening together", startsAt: "2027-12-10T18:00", location: "The studio", venueUrl: "https://venue.example.com", emailContent: { REMINDER: { subject: "Tomorrow!", body: "See you soon" } } };
const response = (subject: string) => Response.json({ success: true, subject, html: `<a href="https://venue.example.com">${subject}</a>`, placeholders: [] });

test("actual component previews unsaved fields, refreshes theme/stage automatically and changes width without a request", async () => {
  const ui = mount(form);
  await ui.settle();
  assert.equal(ui.calls.length, 1); assert.equal(ui.calls[0].body.title, "Unsaved party");
  assert.equal(ui.document.body.style.overflow, "hidden"); assert.equal(ui.stats().shown, 1); assert.equal(ui.stats().focused, 1);
  ui.calls[0].resolve(response("First")); await ui.settle();
  assert.match(ui.find("iframe").props.srcDoc, /aria-disabled="true"/);
  assert.doesNotMatch(ui.find("iframe").props.srcDoc, /href=/);
  ui.find("select", node => node.props.value === "CLASSIC").props.onChange({ target: { value: "CHRISTMAS" } }); await ui.settle();
  assert.equal(ui.calls.length, 2); assert.equal(ui.calls[1].body.templateKey, "CHRISTMAS"); assert.equal(ui.find("iframe"), undefined);
  ui.find("select", node => node.props.value === "INITIAL").props.onChange({ target: { value: "REMINDER" } }); await ui.settle();
  assert.equal(ui.calls[1].signal.aborted, true); assert.equal(ui.calls[2].body.stage, "REMINDER"); assert.equal(ui.calls[2].body.emailContent.REMINDER.subject, "Tomorrow!");
  ui.calls[2].resolve(response("Current reminder")); await ui.settle();
  ui.calls[1].resolve(response("Stale Christmas initial")); await ui.settle();
  assert.match(ui.find("iframe").props.srcDoc, /Current reminder/);
  ui.button("Mobile").props.onClick(); await ui.settle(); assert.equal(ui.find("iframe").props.style.maxWidth, 375); assert.equal(ui.calls.length, 3);
  ui.button("Desktop").props.onClick(); await ui.settle(); assert.equal(ui.find("iframe").props.style.maxWidth, 760);
  assert.equal(form.templateKey, "CLASSIC"); assert.deepEqual(ui.applied, []);
  ui.button("Use this style in draft").props.onClick(); assert.deepEqual(ui.applied, ["CHRISTMAS"]);
  ui.unmount(); assert.equal(ui.document.body.style.overflow, "auto"); assert.equal(ui.stats().restored, 1);
});

test("close/cancel/backdrop abort pending work and restore focus; repeated opening starts from current form", async () => {
  for (const action of ["Close", "Back to editing", "Escape", "backdrop"]) {
    const ui = mount({ ...form }); await ui.settle();
    if (action === "Escape") {
      let prevented = false; ui.find("dialog").props.onCancel({ preventDefault() { prevented = true; } }); assert(prevented);
    } else if (action === "backdrop") {
      const target = { getBoundingClientRect: () => ({ left: 100, right: 600, top: 100, bottom: 600 }) };
      ui.find("dialog").props.onMouseDown({ target, currentTarget: target, clientX: 10, clientY: 10 });
    } else ui.button(action).props.onClick();
    assert.equal(ui.stats().closed, 1); assert.equal(ui.calls[0].signal.aborted, true); assert.deepEqual(ui.applied, []);
    ui.unmount(); ui.calls[0].resolve(response("Too late")); await ui.settle();
    assert.equal(ui.find("iframe"), undefined); assert.equal(ui.stats().restored, 1); assert.equal(ui.stats().hidden, 1);
  }
  const reopened = mount({ ...form, title: "Changed after close", templateKey: "SUMMER" }); await reopened.settle();
  assert.equal(reopened.calls.length, 1); assert.equal(reopened.calls[0].body.title, "Changed after close"); assert.equal(reopened.calls[0].body.templateKey, "SUMMER");
  reopened.unmount();
});


test("Strict Mode effect replay ignores queued close events from the prior dialog opening", async () => {
  const ui = mount(form); await ui.settle();
  ui.replayEffects();
  ui.find("dialog").props.onClose({ currentTarget: { open: true } });
  assert.equal(ui.stats().closed, 0); assert.equal(ui.stats().shown, 2);
  assert.equal(ui.calls.length, 2); assert.equal(ui.calls[0].signal.aborted, true);
  ui.calls[0].resolve(response("Strict Mode old render"));
  ui.calls[1].resolve(response("Strict Mode current render")); await ui.settle();
  assert.match(ui.find("iframe").props.srcDoc, /Strict Mode current render/);
  ui.unmount(); assert.equal(ui.document.body.style.overflow, "auto");
});
