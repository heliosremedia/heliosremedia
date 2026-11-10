/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as helpers from "../../events/rsvp/response-helpers.ts";
import * as themes from "../../../lib/events/themes.ts";

type Invitation = { response: "PENDING" | "YES" | "NO" | "MAYBE"; additionalGuests?: number };
function mount(initial: Invitation = { response: "PENDING", additionalGuests: 0 }, hash = "#token=private-token") {
  const event = { title: "Holiday gathering", description: "Join us", location: "The studio", startsAt: "2030-12-15T18:00:00Z", endsAt: null, timeZone: "UTC", templateKey: "CHRISTMAS", imageUrl: "https://assets.example/party.png", venueUrl: "https://venue.example/" };
  let persisted = { event, ...initial };
  const slots: any[] = [], calls: { path: string; init: RequestInit }[] = [];
  let cursor = 0, dirty = true, tree: any, jobs: (() => void)[] = [];
  let deferPost = false, failPost = false, pendingPost: (() => void) | undefined;
  const hooks = {
    useState(initial: any) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next: any) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; dirty = true; }];
    },
    useRef(initial: any) { const index = cursor++; return slots[index] ||= { current: initial }; },
    useEffect(effect: () => any, dependencies: any[]) {
      const index = cursor++, previous = slots[index];
      if (!previous || dependencies.some((dependency, i) => !Object.is(dependency, previous.dependencies[i]))) {
        jobs.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, effect, cleanup: effect() }; });
      }
    },
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const imports: any = { react: hooks, "react/jsx-runtime": { jsx, jsxs: jsx }, "./response-helpers": helpers, "@/lib/events/themes": themes, "../EventMotif": {} };
  const exports: any = {};
  const location = { hash, pathname: "/events/rsvp" };
  const js = ts.transpileModule(readFileSync(new URL("../../events/rsvp/RsvpResponse.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(js, {
    exports, AbortController, URLSearchParams, Error,
    require: (name: string) => { assert(name in imports, `Unexpected import ${name}`); return imports[name]; },
    window: { location, history: { replaceState(_state: unknown, _title: string, path: string) { assert.equal(path, "/events/rsvp"); location.hash = ""; } } },
    fetch: async (path: string, init: RequestInit) => {
      calls.push({ path, init }); assert.equal(path, "/api/events/rsvp");
      assert.equal(init.cache, "no-store"); assert.equal(init.referrerPolicy, "no-referrer");
      if (!init.method || init.method === "GET") return Response.json(persisted);
      assert.equal(init.method, "POST");
      const body = JSON.parse(String(init.body)); assert.equal(body.token, "private-token");
      const response = () => {
        if (failPost) { failPost = false; return Response.json({ error: "Please try again later." }, { status: 503 }); }
        persisted = { event, response: body.response, additionalGuests: body.response === "NO" ? 0 : body.additionalGuests };
        return Response.json(persisted);
      };
      return deferPost ? new Promise<Response>(resolve => { pendingPost = () => resolve(response()); }) : response();
    },
  });
  function nodes(node: any): any[] { return !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]; }
  const text = (node: any): string => node == null ? "" : typeof node !== "object" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);
  function render() { cursor = 0; dirty = false; jobs = []; tree = exports.default(); for (const job of jobs) job(); }
  async function settle() { for (let count = 0; count < 6; count++) { if (dirty) render(); await new Promise(resolve => setImmediate(resolve)); } }
  const find = (type: string, matches: (node: any) => boolean = () => true) => nodes(tree).find(node => node.type === type && matches(node));
  const count = () => find("input", node => node.props.name === "additionalGuests");
  const radio = (choice: string) => find("input", node => node.props.type === "radio" && node.props.value === choice);
  const submit = () => find("form").props.onSubmit({ preventDefault() {} });
  return {
    settle, find, count, radio, submit, calls, location,
    text: () => text(tree), posts: () => calls.filter(call => call.init.method === "POST"),
    choose: async (choice: string) => { radio(choice).props.onChange(); await settle(); },
    changeCount: async (value: string) => { count().props.onChange({ target: { value } }); await settle(); },
    deferPost: () => { deferPost = true; }, failNextPost: () => { failPost = true; },
    completePost: () => { assert(pendingPost); pendingPost(); },
    replayEffects: () => { for (const slot of slots) if (slot?.effect) { slot.cleanup?.(); slot.cleanup = slot.effect(); } },
    unmount: () => { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test("plus-one form is accessible and records multiple guests only on explicit submit", async () => {
  const ui = mount(); await ui.settle();
  assert.equal(ui.count(), undefined); assert.equal(ui.posts().length, 0);
  await ui.choose("YES");
  assert.equal(ui.count().props.type, "number"); assert.equal(ui.count().props.min, 0); assert.equal(ui.count().props.max, 99); assert.equal(ui.count().props.step, 1);
  assert.equal(ui.count().props.required, true); assert.equal(ui.count().props.value, "0");
  assert.equal(ui.find("label", node => node.props.htmlFor === ui.count().props.id).props.children, "How many guests will you bring?");
  assert.match(ui.count().props["aria-describedby"], /additional-guests-help/);
  assert.match(ui.text(), /Choose 0 if it’s just you/);
  await ui.changeCount("2"); assert.equal(ui.posts().length, 0); assert.match(ui.text(), /Your party: 3 people \(you \+ 2 guests\)/);
  ui.submit(); await ui.settle();
  assert.deepEqual(JSON.parse(String(ui.posts()[0].init.body)), { token: "private-token", response: "YES", additionalGuests: 2 });
  assert.match(ui.text(), /You’re on the guest list/); assert.match(ui.text(), /Your response has been saved/);
  assert.match(ui.find("div", node => node.props.role === "status").props.children.map((node: any) => node.props.children).join(" "), /Your party: 3 people/);
  assert.equal(ui.find("button", node => node.props.type === "submit").props.children, "Update RSVP");
  assert.equal(ui.calls.length, 2); ui.unmount();
});

test("existing personal links load saved guests and allow an update without sending email", async () => {
  const ui = mount({ response: "YES", additionalGuests: 3 }); await ui.settle();
  assert.equal(ui.count().props.value, "3"); assert.match(ui.text(), /Your current response: Yes/); assert.match(ui.text(), /Your party: 4 people/);
  await ui.changeCount("1"); ui.submit(); await ui.settle();
  assert.equal(JSON.parse(String(ui.posts()[0].init.body)).additionalGuests, 1);
  assert.match(ui.text(), /Your party: 2 people/); assert.equal(ui.calls.length, 2); ui.unmount();
});

test("maybe guests remain tentative and choosing no clears the guest count, even before reselecting yes", async () => {
  const ui = mount({ response: "MAYBE", additionalGuests: 2 }); await ui.settle();
  assert.match(ui.text(), /Tentative party: 3 people/);
  await ui.changeCount("4"); ui.submit(); await ui.settle(); assert.match(ui.text(), /Tentative party: 5 people/);
  await ui.choose("NO"); assert.equal(ui.count(), undefined); assert.equal(ui.posts().length, 1);
  ui.submit(); await ui.settle();
  assert.deepEqual(JSON.parse(String(ui.posts()[1].init.body)), { token: "private-token", response: "NO", additionalGuests: 0 });
  assert.doesNotMatch(ui.text(), /Tentative party|Your party/);
  await ui.choose("YES"); assert.equal(ui.count().props.value, "0");
  await ui.changeCount("2"); await ui.choose("NO"); await ui.choose("MAYBE"); assert.equal(ui.count().props.value, "0"); ui.unmount();
});

test("blank, fractional, negative and over-limit guest input never submits or shows a saved result", async () => {
  const ui = mount(); await ui.settle(); await ui.choose("YES");
  for (const value of ["", "1.5", "-1", "100", "1e1"]) {
    await ui.changeCount(value); ui.submit(); await ui.settle();
    assert.equal(ui.posts().length, 0); assert.equal(ui.count().props["aria-invalid"], true); assert.match(ui.text(), /Enter a whole number from 0 to 99/);
    assert.doesNotMatch(ui.text(), /Your response has been saved/);
  }
  await ui.changeCount("99"); assert.equal(ui.count().props["aria-invalid"], undefined); ui.submit(); await ui.settle();
  assert.equal(JSON.parse(String(ui.posts()[0].init.body)).additionalGuests, 99); assert.match(ui.text(), /100 people/); ui.unmount();
});

test("repeated submission sends one request and a failed request retains the draft for retry", async () => {
  const ui = mount({ response: "YES", additionalGuests: 1 }); await ui.settle(); await ui.changeCount("3");
  ui.deferPost(); ui.failNextPost(); ui.submit(); ui.submit(); await ui.settle();
  assert.equal(ui.posts().length, 1); assert.equal(ui.find("fieldset").props.disabled, true); assert.equal(ui.find("button", node => node.props.type === "submit").props.disabled, true);
  ui.completePost(); await ui.settle();
  assert.match(ui.text(), /Please try again later/); assert.equal(ui.count().props.value, "3"); assert.equal(ui.find("fieldset").props.disabled, false);
  assert.match(ui.text(), /Your current response: Yes/); assert.match(ui.text(), /Your party: 2 people/); assert.doesNotMatch(ui.text(), /Your response has been saved/);
  ui.submit(); await ui.settle(); ui.completePost(); await ui.settle();
  assert.equal(ui.posts().length, 2); assert.match(ui.text(), /Your response has been saved/); assert.doesNotMatch(ui.text(), /Please try again later/); ui.unmount();
});

test("email preselection and effect replay preserve private credentials without saving or exposing them", async () => {
  const ui = mount({ response: "YES", additionalGuests: 2 }, "#token=private-token&response=MAYBE"); await ui.settle();
  assert.equal(ui.radio("MAYBE").props.checked, true); assert.equal(ui.count().props.value, "2"); assert.equal(ui.location.hash, ""); assert.equal(ui.posts().length, 0);
  ui.replayEffects(); await ui.settle();
  assert.equal(ui.count().props.value, "2"); assert.equal(ui.calls.length, 2); assert.equal(ui.posts().length, 0);
  assert(ui.calls.every(call => (call.init.headers as Record<string, string>).Authorization === "Bearer private-token"));
  assert.doesNotMatch(ui.text(), /private-token/); assert.equal(ui.find("img").props.referrerPolicy, "no-referrer"); assert.equal(ui.find("a").props.referrerPolicy, "no-referrer"); ui.unmount();
});

test("legacy invitations default to a solo party and incomplete links never request data", async () => {
  const legacy = mount({ response: "YES" }); await legacy.settle();
  assert.equal(legacy.count().props.value, "0"); assert.match(legacy.text(), /1 person \(just you\)/); legacy.unmount();
  const missing = mount(undefined, "#response=YES"); await missing.settle();
  assert.match(missing.text(), /missing or incomplete/); assert.equal(missing.calls.length, 0); assert.equal(missing.count(), undefined); missing.unmount();
});
