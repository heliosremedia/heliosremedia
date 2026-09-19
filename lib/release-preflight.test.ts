import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,writeFile,rm,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {admission,makeManifest,verifyManifest,canonical,digest,requireCandidate} from '../scripts/release/policy.mjs';
import {isolatedEnvironment,treeDigest} from '../scripts/release/gate.mjs';
const sha='a'.repeat(40),sum='b'.repeat(64);
const evidence=()=>({candidate:sha,sourceRevision:sha,sourceHash:sum,identity:{migrationManifest:sum},preflight:{state:'current-compatible-ledger',track:'baseline',ledgerHash:sum},build:{status:'passed',digest:sum},tests:{candidate:sha,status:'passed',count:895,failed:0,applicationSmoke:'passed'},run:'isolated-test'});
test('release accepts only explicit state/track combinations',()=>{
 for(const [selected,state,track,expected] of [['clean-bootstrap','clean-bootstrap-candidate',null,'baseline'],['verified-baseline','supported-historical-ledger','baseline','baseline'],['historical-ledger','supported-historical-ledger','historical','historical'],['current-baseline','current-compatible-ledger','baseline','baseline'],['current-historical','current-compatible-ledger','historical','historical']])assert.equal(admission({state,track},selected),expected);
});
test('unknown failed partial drift and duplicate release states never reach migration',()=>{
 for(const state of ['checksum-mismatch','incomplete-migration','incomplete-ledger','unknown-migration','duplicate-ledger-entry','schema-mismatch','historical-baseline-guards-required','untracked-schema-review'])for(const selected of ['clean-bootstrap','verified-baseline','historical-ledger','current-baseline','current-historical'])assert.throws(()=>admission({state,track:'baseline'},selected));
});
test('no-ledger schema is diagnostic only until explicit baseline establishment',()=>{
 assert.throws(()=>admission({state:'verified-historical-without-ledger',track:null},'verified-baseline'),/never runs migrate resolve/);
});
test('current baseline cannot accidentally use historical directory',()=>{
 assert.throws(()=>admission({state:'current-compatible-ledger',track:'baseline'},'current-historical'));assert.throws(()=>admission({state:'current-compatible-ledger',track:'historical'},'current-baseline'));
});
test('unsupported and inherited hosted environments fail closed',()=>{
 for(const env of [{},{PACKET12_REHEARSAL:'isolated-only',VERCEL_ENV:'production'},{PACKET12_REHEARSAL:'isolated-only',VERCEL_ENV:'preview'},{PACKET12_REHEARSAL:'isolated-only',VERCEL:'1'}])assert.throws(()=>isolatedEnvironment(env));
 isolatedEnvironment({PACKET12_REHEARSAL:'isolated-only'});
});
test('candidate must be a full immutable commit SHA',()=>{
 for(const s of ['HEAD','main','abc123','a'.repeat(39),'g'.repeat(40)])assert.throws(()=>requireCandidate(s));assert.equal(requireCandidate(sha),sha);
});
test('canonical manifest is deterministic independent of object insertion order',()=>{
 assert.equal(canonical({b:2,a:1}),canonical({a:1,b:2}));const e=evidence();assert.deepEqual(makeManifest(e),makeManifest(structuredClone(e)));assert.equal(verifyManifest(makeManifest(e),e),true);
});
test('build failure test failure and pending preflight cannot produce a release',()=>{
 const e=evidence();for(const variant of [{...e,build:{status:'failed',digest:sum}},{...e,tests:{...e.tests,failed:1}},{...e,tests:{...e.tests,applicationSmoke:'pending'}},{...e,preflight:{...e.preflight,state:'supported-historical-ledger'}}])assert.throws(()=>makeManifest(variant));
});
test('tampered manifest checksum cannot be admitted',()=>{
 const e=evidence();assert.throws(()=>verifyManifest({...makeManifest(e),candidate:'c'.repeat(40)},e));
});
test('recomputed checksum cannot conceal stale release evidence or wrong candidate',()=>{
 const e=evidence();for(const field of ['candidate','sourceRevision','sourceHash','identity','preflight','build','tests','run']){
 const m=makeManifest(e);const {checksum,...payload}=m;void checksum;const changed={...payload,[field]:'stale'};assert.throws(()=>verifyManifest({...changed,checksum:digest(changed)},e));
 }
});
test('rollback build must have its own source and artifact receipt',()=>{
 const current=evidence(),prior={...current,sourceRevision:'c'.repeat(40),sourceHash:'d'.repeat(64),build:{status:'passed',digest:'e'.repeat(64)}};
 assert.equal(verifyManifest(makeManifest(prior),prior),true);assert.throws(()=>verifyManifest(makeManifest(current),prior));
});
test('migration state changed after build invalidates release receipt',()=>{
 const e=evidence();assert.throws(()=>verifyManifest(makeManifest(e),{...e,preflight:{...e.preflight,ledgerHash:'f'.repeat(64)}}));
});
test('actual artifact hashing detects content and path changes, ignores only explicit cache',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'release-test-'));
 try{await writeFile(join(dir,'entry.js'),'one');await mkdir(join(dir,'cache'));await writeFile(join(dir,'cache/a'),'one');const a=await treeDigest(dir,{exclude:['cache']});await writeFile(join(dir,'cache/a'),'two');assert.equal(await treeDigest(dir,{exclude:['cache']}),a);await writeFile(join(dir,'entry.js'),'two');assert.notEqual(await treeDigest(dir,{exclude:['cache']}),a);await symlink('/tmp',join(dir,'unsafe'));await assert.rejects(treeDigest(dir),/symlink/);}finally{await rm(dir,{recursive:true,force:true});}
});
