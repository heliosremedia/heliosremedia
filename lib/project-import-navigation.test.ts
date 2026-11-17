import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("view imported photos opens Media then targets collection below sticky nav without focus jump", () => {
  let expanded = false; let focused: unknown; let scrolled: unknown;
  const frames: (() => void)[] = [];
  const target = { getBoundingClientRect: () => ({ top: 1200 }), focus: (options: unknown) => { focused = options; } };
  const exportsUnderTest: { viewImportedProjectPhotos?: () => void } = {};
  vm.runInNewContext(ts.transpileModule(readFileSync("lib/project-import-navigation.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports: exportsUnderTest,
    document: {
      getElementById: (id: string) => id === "project-media" ? { querySelector: () => ({ getAttribute: () => "false", click: () => { expanded = true; } }) } : id === "project-media-collections" ? target : null,
      querySelector: () => ({ getBoundingClientRect: () => ({ height: 150 }) }),
    },
    requestAnimationFrame: (fn: () => void) => frames.push(fn),
    window: { scrollY: 500, matchMedia: () => ({ matches: true }), scrollTo: (options: unknown) => { scrolled = options; } },
  });
  exportsUnderTest.viewImportedProjectPhotos!();
  assert.equal(expanded, true); assert.equal(scrolled, undefined);
  frames.shift()!(); frames.shift()!();
  assert.equal(JSON.stringify(scrolled), JSON.stringify({ top: 1454, behavior: "auto" }));
  assert.equal(JSON.stringify(focused), JSON.stringify({ preventScroll: true }));
});
test("completion refreshes collection only and keeps page location", () => {
  const ui = readFileSync("app/admin/projects/HDPhotoHubImport.tsx", "utf8");
  assert.doesNotMatch(ui, /location.reload|scrollIntoView/);
  assert.match(ui, /refreshInPlace\(\)/);
  assert.match(ui, /helios:project-media-updated/);
  assert.match(ui, /onClick=\{viewImportedProjectPhotos\}/);
  const manager = readFileSync("app/admin/projects/[projectId]/ProjectMediaManager.tsx", "utf8");
  assert.match(manager, /id="project-media-collections" tabIndex=\{-1\}/);
});

test("readiness refresh restores viewport on commit but respects intervening user navigation", () => {
  const hook: { useProjectRefreshInPlace?: () => () => void } = {};
  let pending = false, refreshed = 0;
  let position: { current: unknown } | undefined;
  let layout: (() => unknown)[] = [];
  const events = new Map<string, () => void>();
  const scrolls: unknown[] = [];
  vm.runInNewContext(ts.transpileModule(readFileSync("app/admin/projects/useProjectRefreshInPlace.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports: hook,
    require: (name: string) => name === "next/navigation" ? { useRouter: () => ({ refresh: () => { refreshed++; } }) } : {
      useRef: () => position ??= { current: null },
      useTransition: () => [pending, (fn: () => void) => { pending = true; fn(); }],
      useLayoutEffect: (fn: () => unknown) => layout.push(fn),
    },
    window: { scrollX: 0, scrollY: 900, scrollTo: (value: unknown) => scrolls.push(value), addEventListener: (name: string, fn: () => void) => events.set(name, fn), removeEventListener: (name: string) => events.delete(name) },
  });
  const render = () => { layout = []; const refresh = hook.useProjectRefreshInPlace!(); layout.forEach(fn => fn()); return refresh; };
  render()(); assert.equal(refreshed, 1);
  render(); assert.equal(scrolls.length, 0);
  pending = false; render(); assert.equal(scrolls.length, 1);
  assert.equal(JSON.stringify(scrolls[0]), JSON.stringify({ left: 0, top: 900, behavior: "instant" }));
  render()(); render(); events.get("pointerdown")!();
  pending = false; render(); assert.equal(scrolls.length, 1);
});
