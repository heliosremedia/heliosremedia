/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as layout from "./email-studio-layout.ts";

type CardId = layout.EmailStudioCardId;
const ids = [...layout.EMAIL_STUDIO_CARD_IDS];

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

// Exercise the actual component source with a hook/handler shim, not a DOM.
// Keyed remounts and server/client snapshot selection are simulated explicitly.
// Native keyboard activation, browser focus/drag behavior and hydration need browser QA.
function mount({ storage = memoryStorage(), visibleIds = ids, serverSnapshot = false }: {
  storage?: Pick<Storage, "getItem" | "setItem">;
  visibleIds?: CardId[];
  serverSnapshot?: boolean;
} = {}) {
  let slots: any[] = [], cursor = 0, jobs: (() => void)[] = [];
  let dirty = true, tree: any, mountedKey: string | undefined;
  const listeners = new Set<(event: { key: string | null }) => void>();
  const focused: CardId[] = [];
  const props = {
    workspaceId: "workspace",
    userId: "user",
    cards: visibleIds.map(id => ({ id, label: id, content: { type: "p", props: { children: `Content for ${id}` } } })),
  };
  const hooks = {
    useMemo(create: () => any, dependencies: any[]) {
      const index = cursor++, previous = slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        slots[index] = { dependencies, value: create() };
      }
      return slots[index].value;
    },
    useState(initial: any) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next: any) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; dirty = true; }];
    },
    useRef(initial: any) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect: () => any, dependencies: any[]) {
      const index = cursor++, previous = slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        jobs.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: effect() }; });
      }
    },
    useSyncExternalStore(subscribe: (listener: () => void) => () => void, getSnapshot: () => any, getServerSnapshot: () => any) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { cleanup: subscribe(() => { dirty = true; }) };
      return serverSnapshot ? getServerSnapshot() : getSnapshot();
    },
  };
  const jsx = (type: unknown, props: unknown, key: unknown) => ({ type, props, key });
  const imports: Record<string, any> = {
    react: hooks,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/app/admin/components/AdminCardControls": { AdminCardIconButton: "IconButton", AdminDragHandle: "Drag" },
    "@/lib/email-studio-layout": layout,
  };
  const exports: any = {};
  const source = readFileSync(new URL("../app/admin/email-studio/EmailStudioCardOrganizer.tsx", import.meta.url), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(js, {
    exports,
    require: (name: string) => { assert(name in imports, `Unexpected import ${name}`); return imports[name]; },
    window: {
      localStorage: storage,
      addEventListener: (name: string, callback: (event: { key: string | null }) => void) => { assert.equal(name, "storage"); listeners.add(callback); },
      removeEventListener: (name: string, callback: (event: { key: string | null }) => void) => { assert.equal(name, "storage"); listeners.delete(callback); },
    },
    requestAnimationFrame: (callback: () => void) => { callback(); },
  }, { filename: "EmailStudioCardOrganizer.tsx" });

  function nodes(node: any): any[] {
    return node == null || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  }
  function text(node: any): string {
    return node == null ? "" : typeof node !== "object" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);
  }
  function unmount() { for (const slot of slots) slot?.cleanup?.(); }
  function render() {
    const wrapper = exports.default(props);
    assert.equal(wrapper.key, layout.emailStudioLayoutStorageKey(props.workspaceId, props.userId));
    if (mountedKey !== wrapper.key) {
      unmount(); slots = []; mountedKey = wrapper.key;
    }
    cursor = 0; dirty = false; jobs = [];
    tree = wrapper.type(wrapper.props);
    for (const node of nodes(tree)) {
      if (typeof node.props?.ref === "function") {
        node.props.ref({ focus: (options: { preventScroll: boolean }) => { assert.equal(options.preventScroll, true); focused.push(node.props["data-email-studio-card"]); } });
      }
    }
    for (const job of jobs) job();
  }
  function settle() {
    for (let count = 0; count < 12 && dirty; count++) render();
    assert.equal(dirty, false, "Component rendering should settle");
  }
  const find = (type: string, label?: string) => nodes(tree).find(node => node.type === type && (label === undefined || text(node) === label || node.props.label === label));
  const card = (id: CardId) => nodes(tree).find(node => node.props?.["data-email-studio-card"] === id);
  function click(type: string, label: string) {
    const node = find(type, label);
    assert(node, `Missing ${type}: ${label}`); assert.notEqual(node.props.disabled, true, `${label} is disabled`);
    node.props.onClick(); settle();
  }
  function key(id: CardId, key: string, altKey = true) {
    let prevented = false;
    card(id).props.onKeyDown({ key, altKey, preventDefault: () => { prevented = true; } }); settle();
    return prevented;
  }
  function startDrag(id: CardId) {
    const transfer = { effectAllowed: "", setData: (type: string, value: string) => { assert.equal(type, "text/plain"); assert.equal(value, id); } };
    find("Drag", id).props.onDragStart({ dataTransfer: transfer }); settle();
    assert.equal(transfer.effectAllowed, "move");
  }
  function hover(id: CardId, after: boolean) {
    card(id).props.onDragOver({ preventDefault() {}, dataTransfer: {}, currentTarget: { getBoundingClientRect: () => ({ top: 0, height: 100 }) }, clientY: after ? 99 : 1 }); settle();
  }
  function drop(id: CardId) { card(id).props.onDrop({ preventDefault() {} }); settle(); }
  settle();
  return {
    find, card, click, key, startDrag, hover, drop, focused, storage, unmount,
    order: (): CardId[] => nodes(tree).filter(node => node.props?.["data-email-studio-card"]).map(node => node.props["data-email-studio-card"]),
    status: () => text(nodes(tree).find(node => node.props?.role === "status")),
    content: () => text(tree),
    listenerCount: () => listeners.size,
    finishServerSnapshot: () => { serverSnapshot = false; dirty = true; settle(); },
    updateScope: (workspaceId: string, userId: string) => { props.workspaceId = workspaceId; props.userId = userId; dirty = true; settle(); },
    storageEvent: (key: string | null) => { for (const listener of listeners) listener({ key }); settle(); },
    endDrag: (id: CardId) => { find("Drag", id).props.onDragEnd(); settle(); },
  };
}

test("actual organizer selects stable server defaults before client preferences without writing on mount", () => {
  const storage = memoryStorage(), saved = [...ids].reverse();
  const storageKey = layout.emailStudioLayoutStorageKey("workspace", "user");
  storage.setItem(storageKey, JSON.stringify(saved));
  let writes = 0;
  const ui = mount({ serverSnapshot: true, storage: { getItem: storage.getItem, setItem: () => { writes++; } } });
  assert.deepEqual(ui.order(), ids);
  ui.finishServerSnapshot(); assert.deepEqual(ui.order(), saved); assert.equal(writes, 0);
  assert.equal(ui.find("IconButton"), undefined); assert.equal(ui.card("webhook-health").props.tabIndex, -1);
  assert.equal(ui.key("webhook-health", "ArrowDown"), false); assert.deepEqual(ui.order(), saved);
  ui.unmount(); assert.equal(ui.listenerCount(), 0);
});

test("actual organizer supports repeated arrow controls, Alt keys, focus requests and live position labels", () => {
  const ui = mount(); ui.click("button", "Organize cards");
  assert.equal(ui.find("button", "Done organizing").props["aria-pressed"], true);
  assert.equal(ui.find("IconButton", "Move client-experience up").props.disabled, true);
  assert.equal(ui.find("IconButton", "Move webhook-health down").props.disabled, true);
  for (let position = 2; position >= 0; position--) {
    ui.click("IconButton", "Move webhook-health up");
    assert.equal(ui.order()[position], "webhook-health");
    assert.equal(ui.focused.at(-1), "webhook-health");
    assert.match(ui.status(), new RegExp(`position ${position + 1} of 4`));
    assert.equal(ui.card("webhook-health").props["aria-label"], `webhook-health, position ${position + 1} of 4`);
  }
  assert.equal(ui.key("webhook-health", "ArrowUp"), true); assert.equal(ui.order()[0], "webhook-health");
  assert.equal(ui.key("webhook-health", "ArrowDown", false), false);
  assert.equal(ui.key("webhook-health", "ArrowLeft"), false);
  for (let position = 1; position <= 3; position++) {
    assert.equal(ui.key("webhook-health", "ArrowDown"), true); assert.equal(ui.order()[position], "webhook-health");
  }
  assert.deepEqual(ui.order(), ids);
  ui.click("button", "Done organizing"); assert.equal(ui.find("IconButton"), undefined);
  assert.equal(ui.card("webhook-health").props.tabIndex, -1); ui.unmount();
});

test("actual organizer drag handlers move in both directions and clear cancellation state", () => {
  const ui = mount(); ui.click("button", "Organize cards");
  ui.startDrag("webhook-health"); ui.hover("client-experience", false); ui.drop("client-experience");
  assert.deepEqual(ui.order(), ["webhook-health", "client-experience", "client-gatherings", "analytics-health"]);
  assert.doesNotMatch(ui.card("webhook-health").props.className, /opacity-60/);
  ui.startDrag("webhook-health"); ui.hover("analytics-health", true); ui.drop("analytics-health");
  assert.deepEqual(ui.order(), ids);
  ui.startDrag("webhook-health"); ui.hover("client-experience", false); ui.endDrag("webhook-health");
  ui.drop("client-experience"); assert.deepEqual(ui.order(), ids);
  ui.startDrag("webhook-health"); ui.hover("client-experience", false);
  ui.click("button", "Done organizing"); ui.drop("client-experience"); assert.deepEqual(ui.order(), ids);
  ui.click("button", "Organize cards"); assert.doesNotMatch(ui.card("webhook-health").props.className, /opacity-60/);
  ui.unmount();
});

test("actual organizer reset and reorder preserve hidden card preferences and blocked storage remains usable", () => {
  const storage = memoryStorage(), storageKey = layout.emailStudioLayoutStorageKey("workspace", "user");
  const saved: CardId[] = ["analytics-health", "client-gatherings", "webhook-health", "client-experience"];
  storage.setItem(storageKey, JSON.stringify(saved));
  const ui = mount({ storage, visibleIds: ["analytics-health", "webhook-health"] });
  assert.equal(ui.card("client-experience"), undefined); assert.equal(ui.card("client-gatherings"), undefined);
  ui.click("button", "Organize cards"); ui.click("IconButton", "Move webhook-health up");
  assert.deepEqual(ui.order(), ["webhook-health", "analytics-health"]);
  assert.equal(ui.card("webhook-health").props["aria-label"], "webhook-health, position 1 of 2");
  ui.click("button", "Reset order"); assert.deepEqual(JSON.parse(storage.getItem(storageKey)!), saved);
  assert.equal(ui.find("button", "Reset order").props.disabled, true); ui.unmount();

  const blocked = mount({ storage: { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } } });
  assert.match(blocked.content(), /Browser storage is unavailable/);
  blocked.click("button", "Organize cards"); blocked.click("IconButton", "Move webhook-health up");
  blocked.click("IconButton", "Move webhook-health up"); assert.equal(blocked.order()[1], "webhook-health");
  assert.match(blocked.status(), /this visit only/);
  blocked.click("button", "Reset order"); assert.deepEqual(blocked.order(), ids); blocked.unmount();
});

test("actual organizer scopes cross-tab updates and removes listeners during account/workspace remounts", () => {
  const storage = memoryStorage(), firstKey = layout.emailStudioLayoutStorageKey("workspace", "user");
  const secondKey = layout.emailStudioLayoutStorageKey("workspace", "other-user");
  const workspaceKey = layout.emailStudioLayoutStorageKey("other-workspace", "user");
  storage.setItem(secondKey, JSON.stringify([...ids].reverse()));
  const ui = mount({ storage }); assert.equal(ui.listenerCount(), 1);
  storage.setItem(firstKey, JSON.stringify(["analytics-health"]));
  ui.storageEvent(secondKey); assert.deepEqual(ui.order(), ids);
  ui.storageEvent(firstKey); assert.equal(ui.order()[0], "analytics-health");
  ui.click("button", "Organize cards"); ui.click("IconButton", "Move webhook-health up");
  ui.startDrag("webhook-health"); ui.hover("client-experience", false); assert.notEqual(ui.status(), "");

  ui.updateScope("workspace", "other-user");
  assert.deepEqual(ui.order(), [...ids].reverse()); assert.equal(ui.listenerCount(), 1);
  assert(ui.find("button", "Organize cards")); assert.equal(ui.status(), "");
  assert.doesNotMatch(ui.card("webhook-health").props.className, /opacity-60/);
  storage.setItem(secondKey, JSON.stringify(["client-gatherings"]));
  ui.storageEvent(firstKey); assert.deepEqual(ui.order(), [...ids].reverse());
  ui.storageEvent(secondKey); assert.equal(ui.order()[0], "client-gatherings");

  ui.updateScope("other-workspace", "user"); assert.deepEqual(ui.order(), ids); assert.equal(ui.listenerCount(), 1);
  storage.setItem(workspaceKey, JSON.stringify(["webhook-health"]));
  ui.storageEvent(null); assert.equal(ui.order()[0], "webhook-health");
  ui.unmount(); assert.equal(ui.listenerCount(), 0);
});
