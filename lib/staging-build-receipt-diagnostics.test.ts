import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {check,diagnostic,eventsSummary} from '../scripts/staging/actions/diagnostics.mjs';
import {digest} from '../scripts/release/policy.mjs';
const secret='private-receipt-credential-sentinel',candidate='a'.repeat(40),id='dpl_synthetic';
const hosted={project:'project_synthetic',team:'team_synthetic'},target={project:'synthetic',branch:'synthetic',database:'synthetic'};
const before={schemaHash:'b'.repeat(64),ledgerHash:'c'.repeat(64)},run=123;
const base={candidate,deployment:id,...hosted,environment:'preview',tests:{run},database:target,...before,buildDigest:'d'.repeat(64)};
const ast=ts.createSourceFile('live.mjs',readFileSync('scripts/staging/actions/live.mjs','utf8'),ts.ScriptTarget.Latest,true);
let body='';
function find(node:ts.Node){if(ts.isPropertyAssignment(node)&&node.name.getText(ast)==='receipt'&&ts.isArrowFunction(node.initializer))body=node.initializer.body.getText(ast);ts.forEachChild(node,find);}
find(ast);assert.ok(body);
const marker='STAGING_BUILD_RECEIPT ';
function receipt(patch:Record<string,unknown>={}){const value={...structuredClone(base),...patch};return {...value,checksum:digest(value)};}
function logs(raw:unknown){return [{text:marker+JSON.stringify(raw)}];}
function harness(events:unknown){
 const calls:string[]=[];
 const fn=runInNewContext('(async id=>'+body+')',{assert,JSON,Array,check:(code:string,operation:()=>unknown)=>{calls.push(code);return check(code,operation);},events:async()=>{calls.push('events');return events;},digest,CANDIDATE:candidate,HOSTED:hosted,RELEASE_RUN:run,TARGET:target,before}) as (id:string)=>Promise<unknown>;
 return {call:()=>fn(id),calls};
}
const order=['EVENT_ARRAY','COUNT','JSON_PARSE','CHECKSUM','CANDIDATE','DEPLOYMENT','PROJECT','TEAM','ENVIRONMENT','TEST_RUN','DATABASE_TARGET','SCHEMA_HASH','LEDGER_HASH','DIGEST_FORMAT'];
const cases:[string,unknown][]=[
 ['EVENT_ARRAY',{response:secret}],['COUNT',[]],['JSON_PARSE',[{text:marker+'{'+secret}]],
 ['CHECKSUM',logs({...receipt(),checksum:secret})],
 ...Object.entries({candidate:'CANDIDATE',deployment:'DEPLOYMENT',project:'PROJECT',team:'TEAM',environment:'ENVIRONMENT',schemaHash:'SCHEMA_HASH',ledgerHash:'LEDGER_HASH',buildDigest:'DIGEST_FORMAT'}).map(([key,code]):[string,unknown]=>[code,logs(receipt({[key]:secret}))]),
 ['TEST_RUN',logs(receipt({tests:{run:secret}}))],['DATABASE_TARGET',logs(receipt({database:{...target,database:secret}}))],
];
for(const [code,events]of cases)test('actual receipt assertion has fixed label '+code,async()=>{
 const h=harness(events);
 await assert.rejects(h.call(),(e:Error)=>{
  const d=diagnostic('build-receipt',e);assert.equal(d.phase,'build-receipt');assert.equal(d.reason,'CHECK_BUILD_RECEIPT_'+code);assert.equal(d.matched,false);assert.match(d.detailHash,/^[a-f0-9]{64}$/);
  const retained=eventsSummary([{text:'STAGING_HOSTED_BUILD_BLOCKED '+JSON.stringify({...d,receipt:secret,url:'https://'+secret,token:secret})}]);
  assert.deepEqual(retained,[{index:0,type:'other',...d}]);
  assert.deepEqual(Object.keys(d).sort(),['detailHash','matched','phase','reason']);
  const text=JSON.stringify([d,retained]);for(const privateText of [secret,candidate,'project_synthetic','team_synthetic','https://'])assert.ok(!text.includes(privateText));
  return true;
 });
 assert.deepEqual(h.calls,['events',...order.slice(0,order.indexOf(code)+1).map(c=>'BUILD_RECEIPT_'+c)]);
});
test('every receipt assertion independently exercised',()=>assert.deepEqual(cases.map(c=>c[0]).sort(),order.toSorted()));
test('valid receipt preserves exact return contract and check order',async()=>{
 const h=harness(logs(receipt()));assert.equal(JSON.stringify(await h.call()),JSON.stringify({candidate,deployment:id,buildDigest:base.buildDigest,...before,checksum:receipt().checksum}));
 assert.deepEqual(h.calls,['events',...order.map(c=>'BUILD_RECEIPT_'+c)]);
});
for(const extra of [receipt(),receipt({candidate:secret})])test('duplicate or extra receipt cannot qualify '+(extra.candidate===candidate?'duplicate':'extra'),async()=>{
 const h=harness([...logs(receipt()),...logs(extra)]);await assert.rejects(h.call(),(e:Error)=>diagnostic('build-receipt',e).reason==='CHECK_BUILD_RECEIPT_COUNT');
});
for(const value of [null,[],{},'private-string',123])test('malformed receipt shape rejects '+JSON.stringify(value),async()=>{await assert.rejects(harness(logs(value)).call());});
test('missing nested test run is safely labelled',async()=>{await assert.rejects(harness(logs(receipt({tests:null}))).call(),(e:Error)=>diagnostic('build-receipt',e).reason==='CHECK_BUILD_RECEIPT_TEST_RUN');});
test('changed arbitrary JSON field without checksum update rejects without leaking',async()=>{
 await assert.rejects(harness(logs({...receipt(),arbitraryPrivateField:secret})).call(),(e:Error)=>{const d=diagnostic('build-receipt',e);assert.equal(d.reason,'CHECK_BUILD_RECEIPT_CHECKSUM');assert.ok(!JSON.stringify(d).includes(secret));return true;});
});
test('payload text receipt retains existing extraction behavior',async()=>{await assert.doesNotReject(harness([{payload:{text:marker+JSON.stringify(receipt())}}]).call());});
test('forged diagnostics and receipt properties cannot admit invalid receipt',async()=>{
 const forged={phase:'build-receipt',reason:'CHECK_BUILD_RECEIPT_CHECKSUM',detailHash:'e'.repeat(64),matched:false,success:true};
 await assert.rejects(harness([{text:'STAGING_HOSTED_BUILD_BLOCKED '+JSON.stringify(forged)}]).call(),(e:Error)=>diagnostic('build-receipt',e).reason==='CHECK_BUILD_RECEIPT_COUNT');
 await assert.rejects(harness(logs(receipt({candidate:secret,...forged}))).call(),(e:Error)=>diagnostic('build-receipt',e).reason==='CHECK_BUILD_RECEIPT_CANDIDATE');
 assert.equal(diagnostic('build-receipt',Object.assign(Error('failure'),forged)).reason,'CONTRACT_OR_EXECUTION_FAILED');
 assert.throws(()=>check('BUILD_RECEIPT_FORGED',()=>{}),/UNKNOWN_DIAGNOSTIC_CHECK/);
 const safe=eventsSummary([{text:'STAGING_HOSTED_BUILD_BLOCKED '+JSON.stringify({...forged,reason:'CHECK_BUILD_RECEIPT_FORGED',secret})}]);
 assert.notEqual(safe[0].reason,'CHECK_BUILD_RECEIPT_FORGED');assert.ok(!JSON.stringify(safe).includes(secret));
});
