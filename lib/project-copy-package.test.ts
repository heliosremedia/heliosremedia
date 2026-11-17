import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";
import * as writing from "./project-writing.ts";
const policy: { parseCopyPackage?: (input: unknown) => { source: string; draft: writing.ProjectWritingDraft } } = {};
const compile=(path:string)=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(compile("./project-copy-package.ts"),{exports:policy,require:()=>writing});
const draft=Object.fromEntries(writing.projectWritingFields.map(({key})=>[key,`Edited ${key}\n\nKeep spacing  `])) as writing.ProjectWritingDraft;
function fixture({role="OWNER",workspace="w",projectExists=true,createRace=false}={}) {
  const calls:string[]=[];
  let record: {projectId:string;workspaceId:string;sourceDescription:string;copy:writing.ProjectWritingDraft;revision:number}|null=null;
  type Where={projectId:string;workspaceId:string;revision?:number};
  const modules:Record<string,unknown>={
    "next/server":{NextResponse:{json:(body:unknown,init:ResponseInit)=>new Response(JSON.stringify(body),{...init,headers:{...init.headers,"Content-Type":"application/json"}})}},
    "@/lib/auth/session":{getAdminSession:async()=>role==="NONE"?null:{role,workspaceId:workspace}},
    "@/lib/project-copy-package":policy,
    "@/lib/prisma":{prisma:{
      project:{findFirst:async({where}:{where:{workspaceId:string}})=>projectExists&&where.workspaceId==="w"?{id:"p"}:null},
      projectCopyPackage:{
        findFirst:async({where}:{where:Where})=>record?.workspaceId===where.workspaceId?record:null,
        create:async({data}:{data:NonNullable<typeof record>})=>{calls.push("create");if(record||createRace)throw {code:"P2002"};record=data;return record;},
        updateMany:async({where,data}:{where:Where;data:{sourceDescription:string;copy:writing.ProjectWritingDraft}})=>{calls.push("update");if(!record||record.workspaceId!==where.workspaceId||record.revision!==where.revision)return {count:0};record={...record,...data,revision:record.revision+1};return {count:1};},
      },
    }},
  };
  type Handler=(request:Request,context:{params:Promise<{projectId:string}>})=>Promise<Response>;
  const exports:Record<string,Handler>={};
  vm.runInNewContext(compile("../app/api/admin/projects/[projectId]/copy-package/route.ts"),{exports,require:(key:string)=>modules[key],URL});
  const context={params:Promise.resolve({projectId:"p"})};
  return {calls,get:()=>exports.GET(new Request("https://studio.test/api/copy"),context),save:(body:unknown={source:"Agent source",draft,revision:0},origin="https://studio.test")=>exports.PUT(new Request("https://studio.test/api/copy",{method:"PUT",headers:{Origin:origin},body:JSON.stringify(body)}),context)};
}
test("saved copy preserves all nine edited fields, including blanks, whitespace and YouTube metadata",()=>{
  const input={source:"Agent source",draft:{...draft,videoCaption:""}};
  assert.equal(JSON.stringify(policy.parseCopyPackage!(input)),JSON.stringify(input));
  assert.throws(()=>policy.parseCopyPackage!({...input,draft:{...draft,youtubeTags:"x".repeat(501)}}));
  assert.throws(()=>policy.parseCopyPackage!({...input,source:"x".repeat(12001)}));
});
test("private copy endpoint enforces roles, tenant boundary, origin and revision input",async()=>{
  for(const role of ["NONE","VIEWER"]){const f=fixture({role});assert.equal((await f.get()).status,403);assert.equal((await f.save()).status,403);assert.equal(f.calls.length,0);}
  const cross=fixture({workspace:"other"});assert.equal((await cross.get()).status,404);assert.equal((await cross.save()).status,404);assert.equal(cross.calls.length,0);
  const f=fixture();assert.equal((await f.save(undefined,"https://evil.test")).status,403);
  assert.equal((await f.save({source:"",draft,revision:-1})).status,400);assert.equal(f.calls.length,0);
});
test("save and reopen round-trip privately; stale writes cannot overwrite a newer package",async()=>{
  const f=fixture();assert.equal((await (await f.get()).json()).revision,0);
  assert.equal((await f.save()).status,200);
  const loaded=await f.get();assert.equal(loaded.headers.get("Cache-Control"),"private, no-store");
  const body=await loaded.json();assert.deepEqual(body.package,{source:"Agent source",draft});assert.equal(body.revision,1);
  assert.equal((await f.save({source:"Revised",draft:{...draft,title:"Revised title"},revision:1})).status,200);
  assert.equal((await f.save({source:"Stale",draft,revision:1})).status,409);
  const latest=await (await f.get()).json();assert.equal(latest.package.draft.title,"Revised title");assert.equal(latest.revision,2);
  assert.equal((await fixture({createRace:true}).save()).status,409);
});
test("save UI protects local edits and API never mutates public project/media records",()=>{
  const ui=readFileSync(new URL("../app/admin/projects/ProjectCopyPackageControls.tsx",import.meta.url),"utf8");
  assert.match(ui,/!current.current.source && !current.current.draft/);
  assert.match(ui,/revision: saved.revision/);assert.match(ui,/>Keep my edits</);assert.match(ui,/>Replace with saved copy</);
  assert.match(ui,/beforeunload/);
  const route=readFileSync(new URL("../app/api/admin/projects/[projectId]/copy-package/route.ts",import.meta.url),"utf8");
  assert.doesNotMatch(route,/prisma\.project\.(update|delete|create)|prisma\.media\.|revalidatePath|fetch\(/);
});

test("project helper state is isolated when switching projects",()=>{
  const page=readFileSync(new URL("../app/admin/projects/[projectId]/page.tsx",import.meta.url),"utf8");
  assert.match(page,/<ProjectWritingAssistant projectId=\{project.id\} key=\{project.id\}/);
});

test("saved-copy UI keeps edits on conflict and restores only after explicit replacement",async()=>{
  const existing={source:"Saved source",draft:{...draft,title:"Saved title"}};
  const local={source:"Local edits",draft:{...draft,title:"Unsaved title"}};
  const slots:unknown[]=[];let cursor=0;const restores:unknown[]=[];const requests:unknown[]=[];
  const jsx=(type:unknown,props:unknown)=>({type,props});
  const modules:Record<string,unknown>={
    react:{useState:(initial:unknown)=>{const i=cursor++;if(!(i in slots))slots[i]=i===0?{revision:1,package:existing}:initial;return [slots[i],(value:unknown)=>{slots[i]=typeof value==="function"?value(slots[i]):value;}];},useRef:(current:unknown)=>({current}),useEffect:()=>{}},
    "react/jsx-runtime":{jsx,jsxs:jsx},"@/lib/project-copy-package":policy,"@/lib/project-writing":writing,
  };
  const output:{default?:(props:unknown)=>unknown}={};
  const code=ts.transpileModule(readFileSync(new URL("../app/admin/projects/ProjectCopyPackageControls.tsx",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports:output,require:(key:string)=>modules[key],fetch:async(_url:string,options?:{method?:string;body?:string})=>{requests.push(options);return options?.method==="PUT"?{ok:false,json:async()=>({error:"Another session saved newer copy."})}:{ok:true,json:async()=>({revision:2,package:existing})};}});
  type Node={type?:string;props?:{children?:unknown;onClick?:()=>void}};
  const nodes=(value:unknown):Node[]=>Array.isArray(value)?value.flatMap(nodes):value&&typeof value==="object"?[value as Node,...nodes((value as Node).props?.children)]:[];
  const render=()=>{cursor=0;return nodes(output.default!({projectId:"p",...local,onRestore:(value:unknown)=>restores.push(value)}));};
  const click=async(label:string)=>{const button=render().find(node=>node.type==="button"&&node.props?.children===label);assert.ok(button,label);button.props!.onClick!();await new Promise(resolve=>setTimeout(resolve,0));};
  await click("Save copy package");assert.equal(restores.length,0);assert.equal((slots[0] as {revision:number}).revision,1);assert.equal(local.draft.title,"Unsaved title");
  await click("Load saved copy…");assert.equal(restores.length,0);
  await click("Keep my edits");assert.equal(restores.length,0);assert.equal((slots[0] as {revision:number}).revision,1);
  await click("Load saved copy…");await click("Replace with saved copy");assert.equal(restores.length,1);assert.equal((slots[0] as {revision:number}).revision,2);
  assert.equal(requests.length,3);
});
