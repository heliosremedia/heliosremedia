import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
/* eslint-disable @typescript-eslint/no-explicit-any -- Actual writer; explicit competing-transfer/row-lock simulation, not hosted contention. */
test('homepage creation holds candidate parent ownership through authoritative acknowledgement',async()=>{
 const state={owner:'a',parentLocked:false,transferred:false,rows:[] as any[]};
 const tx:any={
  $queryRaw:async(parts:TemplateStringsArray)=>{if(parts.join('').includes('FOR UPDATE OF p'))state.parentLocked=true;return[];},
  project:{findFirst:async()=>{const row=state.owner==='a'?{id:'p'}:null;if(!state.parentLocked){state.owner='b';state.transferred=true;}return row;}},
  homepageProject:{findMany:async()=>state.owner==='a'?state.rows:[],count:async()=>state.rows.length,create:async({data}:any)=>{assert.equal(state.owner,'a','parent must remain owned when the child is inserted');const row={id:'h',...data,createdAt:new Date()};state.rows.push(row);return row;}},
 };
 const modules:any={'next/server':{NextResponse:Response},'next/cache':{revalidatePath(){}},'@/lib/prisma':{prisma:{$transaction:async(fn:any)=>{try{return await fn(tx);}finally{state.parentLocked=false;}}}},'@/lib/auth/session':{getAdminSession:async()=>({workspaceId:'a',role:'EDITOR'})},'@/lib/workspace-write-access':{requireLockedWorkspaceEditor:async()=>{}},'node:crypto':{createHash:()=>({update:(input:string)=>({digest:()=>input})})}};
 const load=(path:string):any=>{const exports={};runInNewContext(ts.transpileModule(process.env.PACKET6_BASELINE === 'true' && path === 'lib/homepage-curation-write.ts' ? execFileSync('git',['show','26bd99d98e1b86d7c65eec9b353064e3e109fd91:'+path],{encoding:'utf8'}) : readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Error,Date,console,require:(id:string)=>{if(id in modules)return modules[id];return modules[id]=load(id.slice(2)+'.ts');}});return exports;};
 const route=load('app/api/admin/homepage-projects/route.ts');const response=await route.POST(new Request('http://localhost/api',{method:'POST',headers:{'x-curation-revision':JSON.stringify(['a','projects',[]]),'x-curation-request':'request'},body:JSON.stringify({projectId:'p'})}));assert.equal(response.status,201);assert.equal(state.transferred,false);assert.equal((await response.json()).acknowledgement.workspaceId,'a');
});
