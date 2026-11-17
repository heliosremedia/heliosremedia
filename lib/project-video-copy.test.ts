import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { videoCopyFields, PROJECT_WRITING_REQUEST_EVENT } from "./project-video-copy.ts";
import { projectWritingFields, type ProjectWritingDraft } from "./project-writing.ts";
const draft = Object.fromEntries(projectWritingFields.map(({key})=>[key,`Edited ${key}`])) as ProjectWritingDraft;
test("video form copy never substitutes YouTube publishing metadata",()=>{
 assert.deepEqual(videoCopyFields(draft),{title:draft.videoTitle,altText:draft.videoAltText,caption:draft.videoCaption});
});
test("both video forms expose explicit fill and preserve blanks",()=>{
 for(const file of ["ExternalMediaForm","StreamVideoUploader"]){
  const source=readFileSync(`app/admin/projects/[projectId]/${file}.tsx`,"utf8");
  assert.match(source,/<VideoCopyButton projectId=\{projectId\}/);
  assert.match(source,/if \(fields.title.trim\(\)\) setTitle/);
  assert.match(source,/if \(fields.altText.trim\(\)\) setAltText/);
  assert.match(source,/if \(fields.caption.trim\(\)\) setCaption/);
 }
});
test("current edited copy previews, cancel is harmless, confirm fills only video fields without network",async()=>{
 const source=readFileSync("app/admin/projects/VideoCopyButton.tsx","utf8");
 const slots:unknown[]=[];let cursor=0;const applied:unknown[]=[];
 const out:{default?:(props:unknown)=>unknown}={};
 const jsx=(type:unknown,props:unknown)=>({type,props});
 const modules:Record<string,unknown>={react:{useState:(initial:unknown)=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],(value:unknown)=>{slots[i]=value;}];}},"react/jsx-runtime":{jsx,jsxs:jsx},"@/lib/project-copy-package":{parseCopyPackage:()=>{throw Error("unexpected saved parse");}},"@/lib/project-video-copy":{videoCopyFields,PROJECT_WRITING_REQUEST_EVENT}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:out,require:(n:string)=>modules[n],CustomEvent:class{detail:unknown;constructor(_name:string,options:{detail:unknown}){this.detail=options.detail;}},window:{dispatchEvent:(e:{detail:{projectId:string;draft:unknown}})=>{assert.equal(e.detail.projectId,"p");e.detail.draft=draft;}},fetch:()=>{throw Error("must use current edits");}});
 type Node={type?:string;props?:{children?:unknown;onClick?:()=>unknown}};
 const nodes=(v:unknown):Node[]=>Array.isArray(v)?v.flatMap(nodes):v&&typeof v==="object"?[v as Node,...nodes((v as Node).props?.children)]:[];
 const render=()=>{cursor=0;return nodes(out.default!({projectId:"p",onApply:(v:unknown)=>applied.push(v)}));};
 const click=async(label:string)=>{const n=render().find(n=>n.type==="button"&&n.props?.children===label);assert.ok(n,label);n.props!.onClick!();await Promise.resolve();};
 await click("Use AI writer copy…");assert.equal(applied.length,0);
 await click("Cancel");assert.equal(applied.length,0);
 await click("Use AI writer copy…");await click("Confirm fill video fields");
 assert.equal(JSON.stringify(applied),JSON.stringify([videoCopyFields(draft)]));
});
