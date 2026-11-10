/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as helpers from "./ui-helpers.ts";
import * as themes from "../../../lib/events/themes.ts";

type Invitation = { id: string; response: "YES" | "NO" | "MAYBE" | "PENDING"; displayName?: string; email?: string; client?: { id: string; displayName: string; email: string } };
const invitations: Invitation[] = [
  { id: "yes-client", response: "YES", client: { id: "ada", displayName: "Ada Client", email: "ada@example.test" } },
  { id: "yes-snapshot", response: "YES", displayName: "Sam Snapshot", email: "sam@example.test" },
  { id: "maybe", response: "MAYBE", displayName: "Maybe Guest", email: "maybe@example.test" },
  { id: "no", response: "NO", displayName: "Declined Guest", email: "no@example.test" },
  ...Array.from({ length: 162 }, (_, index) => ({ id: `pending-${index}`, response: "PENDING" as const, displayName: `Pending Guest ${index}`, email: `pending-${index}@example.test` })),
];

// Exercise the real EventStudio state, handlers and request boundary without a DOM dependency.
// Browser-native keyboard activation and layout receive separate browser QA.
function mount(guests: Invitation[] = invitations) {
  const event = { id: "holiday", title: "Holiday gathering", description: "A festive evening", location: "The studio", startsAt: "2030-12-15T18:00:00Z", endsAt: null, timeZone: "UTC", status: "SCHEDULED", mode: "ALL", invitations: guests };
  const slots: any[] = [], calls: { path: string; method: string; body: unknown }[] = [];
  let cursor = 0, dirty = true, tree: any, jobs: (() => void)[] = [];
  let deferDetail = false, pendingDetail: ((response: Response) => void) | undefined;
  const hooks = {
    useState(initial: any) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next: any) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; dirty = true; }];
    },
    useCallback(callback: any) { cursor++; return callback; },
    useEffect(effect: () => any, dependencies: any[]) {
      const index = cursor++, previous = slots[index];
      if (!previous || dependencies.some((dependency, i) => !Object.is(dependency, previous.dependencies[i]))) {
        jobs.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: effect() }; });
      }
    },
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const imports: any = {
    react: hooks, "react/jsx-runtime": { jsx, jsxs: jsx }, "./ui-helpers": helpers, "@/lib/events/themes": themes,
    "@/lib/client-communications/scheduling": { zonedLocalToUtc() { throw new Error("No scheduling expected"); } },
    "./EventAppearance": {}, "./EventDraftPreview": {}, "./EventEmailCopy": {},
  };
  const exports: any = {};
  const js = ts.transpileModule(readFileSync(new URL("./EventStudio.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(js, {
    exports,
    require: (name: string) => { assert(name in imports, `Unexpected import ${name}`); return imports[name]; },
    fetch: async (path: string, init: RequestInit) => {
      calls.push({ path, method: init.method!, body: init.body });
      assert.equal(init.method, "GET", "Disclosure, filtering and refreshing must never send, schedule or mutate data");
      if (path === "/api/admin/events") return Response.json({ events: [event], clients: [], groups: [] });
      assert.equal(path, "/api/admin/events/holiday");
      return deferDetail ? new Promise<Response>(resolve => { pendingDetail = resolve; }) : Response.json({ event });
    },
  });
  function nodes(node: any, includeHidden = false): any[] {
    return !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(child => nodes(child, includeHidden)) : !includeHidden && node.props?.hidden ? [] : [node, ...nodes(node.props?.children, includeHidden)];
  }
  const text = (node: any): string => node == null ? "" : typeof node !== "object" ? String(node) : Array.isArray(node) ? node.map(text).join("") : node.props?.hidden ? "" : text(node.props?.children);
  function render() { cursor = 0; dirty = false; jobs = []; tree = exports.default({ defaultTestEmail: "review@example.test" }); for (const job of jobs) job(); }
  async function settle() { for (let count = 0; count < 6; count++) { if (dirty) render(); await new Promise(resolve => setImmediate(resolve)); } }
  const find = (type: string, matches: (node: any) => boolean = () => true) => nodes(tree).find(node => node.type === type && matches(node));
  const button = (label: string) => find("button", node => text(node) === label);
  const section = () => find("section", node => node.props["aria-labelledby"] === "rsvp-title");
  const toggle = () => find("button", node => typeof node.props["aria-expanded"] === "boolean");
  const panel = () => nodes(tree, true).find(node => node.props?.id === toggle().props["aria-controls"]);
  const search = () => find("input", node => node.props.type === "search");
  const filter = () => nodes(panel()).find(node => node.type === "select");
  const guestRows = () => nodes(panel()).filter(node => node.type === "li").map(text);
  async function openEvent() { await settle(); find("button", node => text(node).startsWith(event.title)).props.onClick(); await settle(); }
  async function expand() { if (!toggle().props["aria-expanded"]) { toggle().props.onClick(); await settle(); } }
  return {
    settle, openEvent, expand, find, button, toggle, panel, search, filter, guestRows, calls,
    summary: () => text(section()),
    deferRefresh: () => { deferDetail = true; },
    completeRefresh: (nextGuests = guests) => { assert(pendingDetail); pendingDetail(Response.json({ event: { ...event, invitations: nextGuests } })); },
    failRefresh: () => { assert(pendingDetail); pendingDetail(Response.json({ error: "Refresh unavailable" }, { status: 503 })); },
    unmount: () => { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test("guest responses start collapsed with native keyboard semantics and visible totals and Refresh", async () => {
  const ui = mount(); await ui.openEvent();
  assert.equal(ui.toggle().type, "button"); assert.equal(ui.toggle().props.type, "button");
  assert.equal(ui.toggle().props["aria-expanded"], false); assert.equal(ui.toggle().props["aria-label"], "Expand guest responses");
  assert.equal(ui.panel().props.hidden, true); assert.equal(ui.toggle().props["aria-controls"], ui.panel().props.id);
  assert.equal(ui.toggle().props.onKeyDown, undefined, "Native Enter/Space activation is not overridden");
  assert.equal(ui.toggle().props.tabIndex, undefined, "Disclosure remains in the native keyboard tab order");
  assert.match(ui.toggle().props.className, /focus-visible:outline/);
  assert.match(ui.summary(), /Invited166Yes2Maybe1No1Awaiting reply162/);
  assert(ui.button("Refresh")); assert.equal(ui.search(), undefined); assert.equal(ui.filter(), undefined); assert.deepEqual(ui.guestRows(), []);
  await ui.expand();
  assert.equal(ui.toggle().props["aria-expanded"], true); assert.equal(ui.toggle().props["aria-label"], "Collapse guest responses");
  assert.equal(ui.panel().props.hidden, false); assert.equal(ui.guestRows().length, 166);
  assert.match(ui.guestRows()[0], /Ada Clientada@example.testYes/);
  ui.toggle().props.onClick(); await ui.settle(); assert.equal(ui.panel().props.hidden, true);
  assert.equal(ui.calls.length, 2, "Toggling adds no requests"); ui.unmount();
});

test("repeated collapse and expand retain search and response filters without changing totals or data", async () => {
  const ui = mount(); await ui.openEvent(); await ui.expand();
  ui.filter().props.onChange({ target: { value: "YES" } }); await ui.settle(); assert.equal(ui.guestRows().length, 2);
  ui.search().props.onChange({ target: { value: "ADA@" } }); await ui.settle(); assert.equal(ui.guestRows().length, 1);
  for (let count = 0; count < 3; count++) {
    ui.toggle().props.onClick(); await ui.settle(); assert.equal(ui.search(), undefined);
    await ui.expand(); assert.equal(ui.search().props.value, "ADA@"); assert.equal(ui.filter().props.value, "YES");
    assert.equal(ui.guestRows().length, 1); assert.match(ui.guestRows()[0], /Ada Client/);
  }
  const toggle = ui.toggle().props.onClick;
  toggle(); toggle(); await ui.settle(); assert.equal(ui.toggle().props["aria-expanded"], true);
  assert.match(ui.summary(), /Invited166Yes2Maybe1No1Awaiting reply162/);
  assert.equal(ui.calls.length, 2); assert(ui.calls.every(call => call.body === undefined)); ui.unmount();
});

test("refresh works while collapsed and preserves disclosure and filters while counts update", async () => {
  const ui = mount(); await ui.openEvent(); await ui.expand();
  ui.filter().props.onChange({ target: { value: "YES" } }); ui.search().props.onChange({ target: { value: "ada" } }); await ui.settle();
  ui.toggle().props.onClick(); await ui.settle(); ui.deferRefresh(); ui.button("Refresh").props.onClick(); await ui.settle();
  assert.equal(ui.button("Refresh").props.disabled, true);
  await ui.expand(); assert.equal(ui.search().props.value, "ada");
  ui.toggle().props.onClick(); await ui.settle();
  ui.completeRefresh(invitations.map(invitation => invitation.id === "yes-client" ? { ...invitation, response: "NO" } : invitation)); await ui.settle();
  assert.equal(ui.toggle().props["aria-expanded"], false); assert.equal(ui.panel().props.hidden, true);
  assert.match(ui.summary(), /Invited166Yes1Maybe1No2Awaiting reply162/);
  assert.equal(ui.button("Refresh").props.disabled, false);
  await ui.expand(); assert.equal(ui.search().props.value, "ada"); assert.equal(ui.filter().props.value, "YES");
  assert.match(ui.summary(), /No guests match this filter/); assert.equal(ui.calls.length, 3); ui.unmount();
});

test("empty guest lists and failed refreshes remain usable without resetting the disclosure", async () => {
  const empty = mount([]); await empty.openEvent();
  assert.match(empty.summary(), /Invited0Yes0Maybe0No0Awaiting reply0/);
  await empty.expand(); assert.match(empty.summary(), /No invitations yet/);
  empty.toggle().props.onClick(); await empty.settle(); await empty.expand(); assert.match(empty.summary(), /No invitations yet/); empty.unmount();
  const failed = mount(); await failed.openEvent(); failed.deferRefresh(); failed.button("Refresh").props.onClick(); await failed.settle();
  failed.failRefresh(); await failed.settle();
  assert.equal(failed.toggle().props["aria-expanded"], false); assert.equal(failed.button("Refresh").props.disabled, false);
  assert.equal(failed.find("div", node => node.props.role === "alert").props.children, "Refresh unavailable");
  await failed.expand(); assert.equal(failed.guestRows().length, 166); assert.equal(failed.calls.length, 3); failed.unmount();
});
