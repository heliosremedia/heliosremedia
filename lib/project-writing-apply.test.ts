import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as writing from "./project-writing.ts";
const exports: { projectWritingApplications?: (draft: writing.ProjectWritingDraft, projectId: string | undefined, only: boolean, target: writing.ProjectWritingTarget) => writing.ProjectWritingApplication[] } = {};
const source=readFileSync(new URL("./project-writing-apply.ts",import.meta.url),"utf8");
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>writing});
const draft=Object.fromEntries(writing.projectWritingFields.map(({key})=>[key,`Edited ${key}`])) as writing.ProjectWritingDraft;
test("Apply All snapshots six valid editor destinations, excluding YouTube",()=>{
  const result=exports.projectWritingApplications!(draft,"p",false,"hosted-video");
  assert.equal(result.length,6);
  assert.ok(result.every(item=>item.projectId==="p" && item.value===draft[item.field]));
  assert.ok(result.every(item=>item.target===(item.field.startsWith("video")?"hosted-video":"project")));
  assert.ok(result.every(item=>!item.field.startsWith("youtube")));
});
test("new projects apply only three project fields; empty edits never clear existing fields",()=>{
  assert.equal(exports.projectWritingApplications!(draft,undefined,true,"hosted-video").length,3);
  const result=exports.projectWritingApplications!({...draft,title:" ",videoCaption:""},"p",false,"upload-video");
  assert.equal(result.length,4); assert.ok(result.every(item=>item.field!=="title" && item.field!=="videoCaption"));
  assert.ok(result.filter(item=>item.field.startsWith("video")).every(item=>item.target==="upload-video"));
});
test("batch apply requires confirmation, retains individual actions and never saves or generates",()=>{
  const ui=readFileSync(new URL("../app/admin/projects/ProjectWritingAssistant.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(ui,/>Copy All<|copyAll\(/);
  assert.match(ui,/>Apply All to Editor…</); assert.match(ui,/>Confirm Apply All</);
  assert.match(ui,/setPendingAll\(projectWritingApplications/);
  assert.match(ui,/onClick=\{\(\) => void copy\(key\)\}/);
  assert.match(ui,/aria-label=\{`Apply \$\{label\}`\}/);
  const handler=ui.slice(ui.indexOf("function applyAll()"),ui.indexOf("function apply()"));
  assert.match(handler,/if \(!pendingAll \|\| busy \|\| !allowApply\) return/);
  assert.match(handler,/for \(const application of pendingAll\)/);
  assert.doesNotMatch(handler,/fetch\(|generate\(|setDraft\(/);
});

test("Apply All UI stages confirmation, dispatches edited snapshot only after confirm, and keeps cancel harmless", () => {
  const component=readFileSync(new URL("../app/admin/projects/ProjectWritingAssistant.tsx",import.meta.url),"utf8");
  const slots: unknown[]=[]; let cursor=0; const applied: writing.ProjectWritingApplication[]=[];
  const uiExports: {default?: (props: unknown)=>unknown}={};
  const jsx=(type:unknown,props:unknown)=>({type,props});
  const modules: Record<string,unknown>={
    react:{useState:(initial:unknown)=>{const i=cursor++; if(!(i in slots)) slots[i]=i===1?{...draft}:initial; return [slots[i],(v:unknown)=>{slots[i]=typeof v==="function"?v(slots[i]):v;}];},useRef:(current:unknown)=>({current}),useEffect:()=>{}},
    "react/jsx-runtime":{jsx,jsxs:jsx}, "@/app/admin/components/AdminCardHeading":{default:()=>null},
    "@/lib/project-writing":writing, "@/lib/project-writing-apply":exports, "./ProjectCopyPackageControls": {default:()=>null},
  };
  vm.runInNewContext(ts.transpileModule(component,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:uiExports,require:(name:string)=>modules[name]});
  type Node={type?:string;props?:{children?:unknown;onClick?:()=>void}};
  const nodes=(x:unknown):Node[]=>Array.isArray(x)?x.flatMap(nodes):x&&typeof x==="object"?[x as Node,...nodes((x as Node).props?.children)]:[];
  const render=()=>{cursor=0;return nodes(uiExports.default!({projectId:"p",onApply:(value:writing.ProjectWritingApplication)=>applied.push(value)}));};
  const click=(label:string)=>{const button=render().find(node=>node.type==="button"&&node.props?.children===label);assert.ok(button,label);button.props!.onClick!();};
  click("Apply All to Editor…"); assert.equal(applied.length,0);
  click("Cancel"); assert.equal(applied.length,0);
  click("Apply All to Editor…"); click("Confirm Apply All");
  assert.equal(applied.length,3); assert.equal(applied[0].value,draft.title);
  assert.equal(render().filter(node=>node.type==="button"&&node.props?.children==="Confirm Apply All").length,0);
});
