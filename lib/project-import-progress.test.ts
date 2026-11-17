import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = readFileSync("app/admin/projects/PhotoImportProgress.tsx", "utf8");
const out: { default?: (props: unknown) => unknown } = {};
const jsx = (type: unknown, props: unknown) => ({type,props});
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:out,require:()=>({jsx,jsxs:jsx})});
type Node = {props?:Record<string,unknown>};
const nodes=(v:unknown):Node[]=>Array.isArray(v)?v.flatMap(nodes):v&&typeof v==="object"?[v as Node,...nodes((v as Node).props?.children)]:[];
test("progress is determinate, accessible and not rounded up to complete",()=>{
 const tree=nodes(out.default!({value:{total:201,done:200,state:"running"}}));
 const bar=tree.find(n=>n.props?.role==="progressbar")!.props!;
 assert.equal(bar["aria-valuenow"],200);assert.equal(bar["aria-valuemax"],201);
 assert.equal(bar["aria-valuetext"],"200 of 201 selected photos ready");
 assert.ok(tree.some(n=>(n.props?.style as {width?:string})?.width==="99%"));
});
test("failure preserves partial progress and retry begins its new selected batch at zero",()=>{
 for(const [done,total,state,width] of [[7,68,"stopped","10%"],[0,61,"running","0%"],[61,61,"complete","100%"]] as const){
  const tree=nodes(out.default!({value:{done,total,state}}));
  assert.ok(tree.some(n=>(n.props?.style as {width?:string})?.width===width));
  if(state==="stopped")assert.ok(JSON.stringify(tree).includes("Ready photos are kept"));
 }
});
test("import counts only successful server acknowledgements incl already-imported retries",()=>{
 const ui=readFileSync("app/admin/projects/HDPhotoHubImport.tsx","utf8");
 assert.match(ui,/const total = selected.length/);
 assert.match(ui,/await post\(\{ action: "photo", mediaId \}\);[\s\S]*?setProgress\(\{ total, done: imported \+ existing, state: "running" \}\)/);
 assert.match(ui,/catch \(e\) \{ setProgress\(\{ total, done: imported \+ existing, state: "stopped" \}\)/);
 assert.match(ui,/setProgress\(\{ total, done: 0, state: "running" \}\)/);
 assert.match(ui,/setProgress\(\{ total, done: imported \+ existing, state: "complete" \}\)/);
});

test("progress spacing survives global paragraph margin resets",()=>{
 assert.match(source,/className="flex flex-col gap-2 rounded-xl/);
 assert.doesNotMatch(source,/space-y-/);
});
