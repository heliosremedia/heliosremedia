import assert from 'node:assert/strict';
import test from 'node:test';
import {BASELINE,classify} from '../scripts/migrations/bootstrap/inspect.mjs';
import {requireDatabase,databaseUrl} from '../scripts/migrations/bootstrap/artifact.mjs';
const old='20260801000000_old',next='20260910050000_v2';
const historical={tables:['old']},current={tables:['old','new']};
const manifest={[old]:'old-sha',[next]:'new-sha'};
const row=(name:string,checksum:string)=>({id:name,migration_name:name,checksum,started_at:'2026-09-01',finished_at:'2026-09-02',rolled_back_at:null,applied_steps_count:1});
const inspect=(ledger:unknown[],schema:unknown)=>classify({ledger,schema,historical,current,manifest,baselineChecksum:'baseline-sha'});
test('bootstrap distinguishes empty, verified no-ledger and untracked current schema',()=>{
 assert.equal(inspect([],{tables:[]}).state,'clean-bootstrap-candidate');assert.equal(inspect([],historical).mayBaseline,true);assert.equal(inspect([],current).state,'untracked-schema-review');
});
test('original ledger continues without switching migration identities',()=>{
 assert.equal(inspect([row(old,'old-sha')],historical).state,'supported-historical-ledger');assert.equal(inspect([row(old,'old-sha'),row(next,'new-sha')],current).track,'historical');
});
test('baseline track uses one honest schema baseline and identical V2 names',()=>{
 assert.equal(inspect([row(BASELINE,'baseline-sha')],historical).track,'baseline');assert.equal(inspect([row(BASELINE,'baseline-sha'),row(next,'new-sha')],current).state,'current-compatible-ledger');assert.equal(inspect([row(BASELINE,'baseline-sha'),row(old,'old-sha')],historical).state,'unknown-migration');
});
test('missing, unknown and altered entries fail closed',()=>{
 for(const [rows,state] of [[[row(next,'new-sha')],'incomplete-ledger'],[[row('unknown','x')],'unknown-migration'],[[row(old,'changed')],'checksum-mismatch']] as const){const r=inspect([...rows],current);assert.equal(r.state,state);assert.equal(r.mayDeploy,false);assert.equal(r.automaticRepair,false);}
});
test('failed and rolled-back attempts cannot be auto-resolved',()=>{
 assert.equal(inspect([{...row(old,'old-sha'),finished_at:null}],historical).state,'incomplete-migration');assert.equal(inspect([{...row(old,'old-sha'),rolled_back_at:'2026-09-03'}],historical).state,'rolled-back-history-review');
});
test('ledger metadata and duplicate successful records are validated',()=>{
 assert.equal(inspect([{...row(old,'old-sha'),finished_at:'2026-08-01'}],historical).state,'invalid-ledger-metadata');assert.equal(inspect([row(old,'old-sha'),row(old,'old-sha')],historical).state,'duplicate-ledger-entry');
});
test('ledger success cannot disguise missing schema objects or defaults',()=>{
 assert.equal(inspect([row(old,'old-sha')],{tables:['altered']}).state,'schema-mismatch');assert.equal(inspect([row(old,'old-sha'),row(next,'new-sha')],historical).state,'schema-mismatch');
});
test('mutating rehearsal tooling only accepts exact disposable URLs',()=>{
 assert.equal(requireDatabase(databaseUrl('packet11_clean')),databaseUrl('packet11_clean'));for(const u of ['postgresql://prod/customer',databaseUrl('packet11_clean')+'?schema=other',databaseUrl('packet11_clean').replace('127.0.0.1','localhost')])assert.throws(()=>requireDatabase(u));
});
test('historical schema missing SQL-only guards requires an explicit step before baseline',()=>{
 const r=classify({ledger:[],schema:{tables:['snapshot']},historical,current,manifest,baselineChecksum:'baseline-sha',pinnedHistorical:{tables:['snapshot']}});assert.equal(r.state,'historical-baseline-guards-required');assert.equal(r.mayBaseline,false);assert.equal(r.mayDeploy,false);
});
