import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// Run the actual planner and timezone conversion under independent host clocks.
// No application database, provider or scheduling queue is connected.
const probe = `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function load(path, modules) {
 const exports={}; runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {exports, Date, Intl, Error, require(id){assert.ok(id in modules,id);return modules[id];}}); return exports;
}
const core=load('lib/social/core.ts',{}), scheduling=load('lib/client-communications/scheduling.ts',{});
let series, rows=new Map(), access=true;
const tx={
 $queryRaw:async()=>[],
 socialSeries:{findFirst:async({where})=>{assert.equal(where.workspaceId,'a');assert.equal(where.status,'ACTIVE');return series;},update:async()=>{}},
 socialSeriesOccurrence:{createMany:async({data,skipDuplicates})=>{assert.equal(skipDuplicates,true);let count=0;for(const row of data){const k=row.platform+row.scheduledAt.toISOString();if(!rows.has(k)){rows.set(k,{...row,scheduledAt:row.scheduledAt.toISOString()});count++;}}return{count};}},
};
const planner=load('lib/social/series.ts',{'./core':core,'@/lib/client-communications/scheduling':scheduling,'@/lib/prisma':{prisma:{$transaction:fn=>fn(tx)}},'@/lib/workspace-write-access':{requireLockedWorkspaceEditor:async(_tx,actor)=>{assert.equal(actor.workspaceId,'a');if(!access)throw new Error('WORKSPACE_WRITE_FORBIDDEN');}}});
const results=[];
for(const fixture of [
 {frequency:'WEEKLY',startsAt:'2026-10-26',through:'2026-11-10',dayOfWeek:1,dayOfMonth:null,timeZone:'America/Denver'},
 {frequency:'MONTHLY',startsAt:'2026-01-31',through:'2026-05-01',dayOfWeek:null,dayOfMonth:31,timeZone:'Australia/Brisbane'},
]){
 rows=new Map();series={...fixture,id:'series',startsAt:new Date(fixture.startsAt),endsAt:null,localTime:'09:00',interval:1,defaultPlatforms:['FACEBOOK']};
 const input={seriesId:'series',actor:{workspaceId:'a',userId:'ua',sessionVersion:1},through:new Date(fixture.through)};
 const first=await planner.generateSeriesOccurrences(input);const retry=await planner.generateSeriesOccurrences(input);assert.equal(retry.created,0);
 access=false;await assert.rejects(planner.generateSeriesOccurrences(input),/WORKSPACE_WRITE_FORBIDDEN/);access=true;
 results.push({first,retry,dates:[...rows.values()].map(x=>x.scheduledAt)});
}
let created;
const creationTx={socialSeries:{create:async({data})=>{created=data;return{id:'new-series'};}}};
const creation=load('app/api/admin/social/series/route.ts',{'next/server':{NextResponse:Response},'@/lib/auth/session':{getAdminSession:async()=>({workspaceId:'a',userId:'ua',role:'EDITOR',sessionVersion:1})},'@/lib/prisma':{prisma:{$transaction:fn=>fn(creationTx)}},'@/lib/social/core':core,'@/lib/social/series':{normalizeSeriesFrequency:planner.normalizeSeriesFrequency,generateSeriesOccurrences:async(input,tx)=>{assert.equal(tx,creationTx);created.through=input.through;return{created:0};}},'@/lib/workspace-write-access':{requireLockedWorkspaceEditor:async()=>{}}});
const response=await creation.POST(new Request('https://example.test',{method:'POST',body:JSON.stringify({name:'Series',platforms:['FACEBOOK'],startsAt:'2026-10-26',timeZone:'America/Denver'})}));assert.equal(response.status,201);
results.push({dayOfWeek:created.dayOfWeek,dayOfMonth:created.dayOfMonth,startsAt:created.startsAt.toISOString(),through:created.through.toISOString()});
console.log(JSON.stringify(results));
`;

test('series generation keeps exact company-local schedules across host timezones and DST', () => {
  const outputs = ['UTC', 'Australia/Brisbane', 'America/Los_Angeles'].map(TZ => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { cwd: new URL('..', import.meta.url), env: { ...process.env, TZ }, encoding: 'utf8', timeout: 20000 });
    assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout);
  });
  for (const result of outputs) {
    assert.deepEqual(result, outputs[0]);
    assert.deepEqual(result[0].dates, ['2026-10-26T15:00:00.000Z','2026-11-02T16:00:00.000Z','2026-11-09T16:00:00.000Z']);
    assert.deepEqual(result[1].dates, ['2026-01-30T23:00:00.000Z','2026-02-27T23:00:00.000Z','2026-03-30T23:00:00.000Z','2026-04-29T23:00:00.000Z']);
    assert.deepEqual(result[2], { dayOfWeek: 1, dayOfMonth: 26, startsAt: '2026-10-26T00:00:00.000Z', through: '2027-01-26T00:00:00.000Z' });
    assert.equal(result[0].first.created, 3); assert.equal(result[1].first.created, 4);
  }
});
