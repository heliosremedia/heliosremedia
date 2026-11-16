import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as collections from "./video-media-services.ts";
import * as writing from "./project-writing.ts";

function mount(name: string, services: unknown[]) {
  const slots: unknown[] = [];
  let cursor = 0;
  let tree: any;
  const handlers = new Map<string, (event: unknown) => void>();
  const hooks = {
    useState(initial: unknown) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], (value: unknown) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; },
    useRef(value: unknown) { return { current: value }; },
    useMemo(callback: () => unknown) { return callback(); },
    useEffect(callback: () => void) { callback(); },
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const exports: any = {};
  const modules: Record<string, unknown> = {
    react: hooks, "react/jsx-runtime": { jsx, jsxs: jsx },
    "tus-js-client": {},
    "@/lib/external-media": { resolveExternalMedia: () => null },
    "@/lib/service-media": { mediaCategoryForServiceSlug: () => "CINEMATIC_FILM" },
    "@/lib/video-media-services": collections,
    "@/lib/project-writing": writing,
  };
  const code = ts.transpileModule(readFileSync(new URL("../app/admin/projects/[projectId]/" + name, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: (key: string) => { assert.ok(key in modules, key); return modules[key]; }, window: { addEventListener: (key: string, handler: (event: unknown) => void) => handlers.set(key, handler), removeEventListener() {} }, document: { getElementById: () => null }, requestAnimationFrame: (callback: () => void) => callback(), fetch: () => { throw new Error("Must not submit"); } });
  const render = () => { cursor = 0; tree = exports.default({ projectId: "project", services, onMediaAdded() {} }); };
  const nodes = (item: any): any[] => !item || typeof item !== "object" ? [] : Array.isArray(item) ? item.flatMap(nodes) : [item, ...nodes(item.props?.children)];
  render();
  return { render, nodes: () => nodes(tree), apply: (detail: unknown) => { handlers.get(writing.PROJECT_WRITING_APPLY_EVENT)?.({ detail }); render(); } };
}
const service = (slug: string) => ({ id: slug, slug, name: slug, active: true, archivedAt: null, description: null, displayOrder: 0 });
for (const file of ["ExternalMediaForm.tsx", "StreamVideoUploader.tsx"]) {
  test(file + " defaults to cinematic and exposes exactly five video destinations", () => {
    const ui = mount(file, ["photography", "cinematic-films", "agent-branding", "ai-cinematic-films", "vertical-reels", "social-content"].map(service));
    ui.nodes().find((node) => node.type === "button").props.onClick(); ui.render();
    const select = ui.nodes().find((node) => node.type === "select" && node.props.value === "cinematic-films");
    assert.ok(select);
    const options = select.props.children.flat().filter(Boolean);
    assert.equal(options.length, 5);
    assert.deepEqual(Array.from(options, (node: any) => node.props.value), ["cinematic-films", "agent-branding", "ai-cinematic-films", "vertical-reels", "social-content"]);
    select.props.onChange({ target: { value: "agent-branding" } }); ui.render();
    ui.nodes().find((node) => node.type === "button").props.onClick(); ui.render();
    ui.nodes().find((node) => node.type === "button").props.onClick(); ui.render();
    assert.ok(ui.nodes().some((node) => node.type === "select" && node.props.value === "agent-branding"));
  });
  test(file + " disables submission without an active cinematic or chosen video service", () => {
    const ui = mount(file, [service("photography")]);
    ui.nodes().find((node) => node.type === "button").props.onClick(); ui.render();
    const submit = ui.nodes().find((node) => node.type === "button" && node.props.type === "submit");
    assert.equal(submit.props.disabled, true);
  });
}

for (const [file, target] of [["ExternalMediaForm.tsx", "hosted-video"], ["StreamVideoUploader.tsx", "upload-video"]]) {
  test(file + " applies reviewed copy only to the correct project and video target", () => {
    const ui = mount(file, [service("cinematic-films")]);
    ui.apply({ projectId: "wrong", target, field: "videoTitle", value: "Wrong project" });
    assert.ok(!ui.nodes().some(node => node.props?.value === "Wrong project"));
    ui.apply({ projectId: "project", target, field: "videoTitle", value: "Reviewed title" });
    assert.ok(ui.nodes().some(node => node.type === "input" && node.props.value === "Reviewed title"));
    ui.apply({ projectId: "project", target: target === "hosted-video" ? "upload-video" : "hosted-video", field: "videoTitle", value: "Wrong target" });
    assert.ok(ui.nodes().some(node => node.type === "input" && node.props.value === "Reviewed title"));
    ui.apply({ projectId: "project", target, field: "videoCaption", value: "Reviewed caption" });
    assert.ok(ui.nodes().some(node => node.props?.value === "Reviewed caption"));
  });
}
