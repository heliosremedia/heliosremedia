import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_EMAIL_STUDIO_LAYOUT,
  EMAIL_STUDIO_CARD_IDS,
  createEmailStudioLayoutStore,
  emailStudioLayoutStorageKey,
  moveEmailStudioCard,
  normalizeEmailStudioCardOrder,
  resetEmailStudioCardOrder,
  type EmailStudioCardId,
} from "./email-studio-layout.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

test("Email Studio defaults and corrupt preferences retain every known card exactly once", () => {
  for (const value of [null, undefined, {}, 2, "webhook-health"]) {
    assert.deepEqual(normalizeEmailStudioCardOrder(value), EMAIL_STUDIO_CARD_IDS);
  }
  assert.deepEqual(normalizeEmailStudioCardOrder(["webhook-health", "unknown", "webhook-health", null, "client-gatherings"]), [
    "webhook-health", "client-gatherings", "client-experience", "analytics-health",
  ]);
});

test("Email Studio moves cards in both directions, including first and last positions", () => {
  const order = [...EMAIL_STUDIO_CARD_IDS];
  const lastFirst = moveEmailStudioCard(order, order, "webhook-health", 0);
  assert.deepEqual(lastFirst, ["webhook-health", "client-experience", "client-gatherings", "analytics-health"]);
  assert.deepEqual(moveEmailStudioCard(lastFirst, order, "webhook-health", 3), order);
  assert.deepEqual(moveEmailStudioCard(order, order, "client-gatherings", 2), ["client-experience", "analytics-health", "client-gatherings", "webhook-health"]);
  assert.deepEqual(order, EMAIL_STUDIO_CARD_IDS, "the original array is not mutated");
});

test("Email Studio invalid, boundary, and same-position moves are safe no-ops", () => {
  for (const target of [-1, 4, NaN, 0.5, 0]) {
    assert.deepEqual(moveEmailStudioCard(EMAIL_STUDIO_CARD_IDS, EMAIL_STUDIO_CARD_IDS, "client-experience", target), EMAIL_STUDIO_CARD_IDS);
  }
  assert.deepEqual(moveEmailStudioCard(EMAIL_STUDIO_CARD_IDS, ["analytics-health", "webhook-health"], "client-experience", 1), EMAIL_STUDIO_CARD_IDS);
});

test("Email Studio visible reorder and reset retain hidden role-only card preferences", () => {
  const order: EmailStudioCardId[] = ["analytics-health", "client-gatherings", "webhook-health", "client-experience"];
  const visible: EmailStudioCardId[] = ["analytics-health", "webhook-health"];
  const moved = moveEmailStudioCard(order, visible, "webhook-health", 0);
  assert.deepEqual(moved, ["webhook-health", "client-gatherings", "analytics-health", "client-experience"]);
  assert.deepEqual(resetEmailStudioCardOrder(moved, visible), order);
  assert.deepEqual(resetEmailStudioCardOrder(moved, EMAIL_STUDIO_CARD_IDS), EMAIL_STUDIO_CARD_IDS);
  assert.deepEqual(resetEmailStudioCardOrder(moved, []), moved);
});

test("Email Studio browser keys isolate accounts and workspaces without delimiter collisions", () => {
  assert.notEqual(emailStudioLayoutStorageKey("workspace", "user-a"), emailStudioLayoutStorageKey("workspace", "user-b"));
  assert.notEqual(emailStudioLayoutStorageKey("workspace-a", "user"), emailStudioLayoutStorageKey("workspace-b", "user"));
  assert.notEqual(emailStudioLayoutStorageKey("a:b", "c"), emailStudioLayoutStorageKey("a", "b:c"));
  const storage = memoryStorage();
  const a = createEmailStudioLayoutStore(emailStudioLayoutStorageKey("workspace", "user-a"), () => storage);
  const b = createEmailStudioLayoutStore(emailStudioLayoutStorageKey("workspace", "user-b"), () => storage);
  const c = createEmailStudioLayoutStore(emailStudioLayoutStorageKey("other-workspace", "user-a"), () => storage);
  a.save([...EMAIL_STUDIO_CARD_IDS].reverse());
  assert.deepEqual(b.getSnapshot().order, EMAIL_STUDIO_CARD_IDS);
  assert.deepEqual(c.getSnapshot().order, EMAIL_STUDIO_CARD_IDS);
  assert.deepEqual(createEmailStudioLayoutStore(emailStudioLayoutStorageKey("workspace", "user-a"), () => storage).getSnapshot().order, [...EMAIL_STUDIO_CARD_IDS].reverse());
});

test("Email Studio SSR snapshot is stable and never reads browser storage", () => {
  let reads = 0;
  const store = createEmailStudioLayoutStore("test", () => { reads++; throw new Error("no window"); });
  assert.equal(store.getServerSnapshot(), DEFAULT_EMAIL_STUDIO_LAYOUT);
  assert.equal(store.getServerSnapshot(), store.getServerSnapshot());
  assert.equal(reads, 0);
  assert.equal(store.getSnapshot().storageAvailable, false);
  assert.equal(store.getSnapshot(), store.getSnapshot(), "client snapshots are cached for React");
});

test("Email Studio malformed browser storage falls back without overwriting it during mount", () => {
  const storage = memoryStorage();
  for (const raw of ["{invalid", "null", '{"order": ["webhook-health"]}', '[]']) {
    storage.setItem("test", raw);
    const store = createEmailStudioLayoutStore("test", () => storage);
    assert.deepEqual(store.getSnapshot().order, EMAIL_STUDIO_CARD_IDS);
    assert.equal(storage.getItem("test"), raw);
  }
});

test("Email Studio blocked storage still supports repeated moves for the current visit", () => {
  const store = createEmailStudioLayoutStore("test", () => { throw new Error("blocked"); });
  assert.equal(store.getSnapshot().storageAvailable, false);
  const moved = moveEmailStudioCard(store.getSnapshot().order, EMAIL_STUDIO_CARD_IDS, "webhook-health", 0);
  assert.equal(store.save(moved), false);
  assert.deepEqual(store.getSnapshot().order, moved);
  assert.equal(store.save(moveEmailStudioCard(store.getSnapshot().order, EMAIL_STUDIO_CARD_IDS, "webhook-health", 1)), false);
  assert.equal(store.getSnapshot().order[1], "webhook-health");
});

test("Email Studio write failures preserve the new order and successful retry restores persistence", () => {
  const storage = memoryStorage();
  let blocked = true;
  const store = createEmailStudioLayoutStore("test", () => ({
    getItem: storage.getItem,
    setItem: (key, value) => { if (blocked) throw new Error("quota"); storage.setItem(key, value); },
  }));
  const reversed = [...EMAIL_STUDIO_CARD_IDS].reverse();
  assert.equal(store.save(reversed), false);
  assert.deepEqual(store.getSnapshot().order, reversed);
  blocked = false;
  assert.equal(store.save(reversed), true);
  assert.equal(store.getSnapshot().storageAvailable, true);
  assert.deepEqual(JSON.parse(storage.getItem("test")!), reversed);
});

test("Email Studio saves and cross-tab refresh notify subscribers and reset survives reload", () => {
  const storage = memoryStorage();
  const store = createEmailStudioLayoutStore("test", () => storage);
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications++; });
  store.save([...EMAIL_STUDIO_CARD_IDS].reverse());
  storage.setItem("test", JSON.stringify(["analytics-health", "webhook-health"]));
  store.refresh();
  assert.equal(store.getSnapshot().order[0], "analytics-health");
  store.save(resetEmailStudioCardOrder(store.getSnapshot().order, EMAIL_STUDIO_CARD_IDS));
  assert.deepEqual(createEmailStudioLayoutStore("test", () => storage).getSnapshot().order, EMAIL_STUDIO_CARD_IDS);
  assert.equal(notifications, 3);
  unsubscribe();
  store.save(EMAIL_STUDIO_CARD_IDS);
  assert.equal(notifications, 3);
});

test("Email Studio integration preserves server role checks, source content, and accessible controls", () => {
  const page = readFileSync(new URL("../app/admin/email-studio/page.tsx", import.meta.url), "utf8");
  const organizer = readFileSync(new URL("../app/admin/email-studio/EmailStudioCardOrganizer.tsx", import.meta.url), "utf8");
  assert.match(page, /if \(\["OWNER", "ADMIN"\]\.includes\(session\.role\)\) \{\s*cards\.push\([\s\S]*?id: "client-experience"[\s\S]*?id: "client-gatherings"[\s\S]*?\);\s*\}/);
  assert.match(page, /workspaceId=\{session\.workspaceId\} userId=\{session\.userId\}/);
  assert.match(page, /id="analytics-health"/);
  assert.match(page, /href="\/admin\/events"/);
  assert.match(page, /href="\/admin\/email-studio\/monthly-summaries"/);
  assert.match(organizer, /key=\{storageKey\}/);
  assert.match(organizer, /useSyncExternalStore/);
  assert.match(organizer, /role="status" aria-live="polite"/);
  assert.match(organizer, /disabled=\{index === 0\}/);
  assert.match(organizer, /disabled=\{index === visibleOrder\.length - 1\}/);
  assert.match(organizer, /event\.altKey/);
  assert.match(organizer, /onDragEnd=\{clearDrag\}/);
});
