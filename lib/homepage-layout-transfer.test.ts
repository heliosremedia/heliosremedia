import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
/* eslint-disable @typescript-eslint/no-explicit-any -- Actual private layout route, transferred account delegate. */
test('private homepage layout rejects zero-row update after account transfer',async()=>{
 const exports:any={};const modules:any={'next/server':{NextResponse:Response},'@/lib/auth/session':{getAdminSession:async()=>({userId:'u',workspaceId:'old'})},'@/lib/homepage-curation-layout':{normalizeHomepageCurationPreferences:(x:any)=>x},'@/lib/prisma':{prisma:{adminUser:{updateMany:async()=>({count:0})}}}};
 runInNewContext(ts.transpileModule(readFileSync('app/api/admin/homepage-layout/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,console,require:(id:string)=>modules[id]});assert.equal((await exports.PATCH(new Request('http://localhost/api',{method:'PATCH',body:'{}'}))).status,409);
});
