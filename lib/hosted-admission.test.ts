import test from 'node:test';
import assert from 'node:assert/strict';
import {makeManifest} from '../scripts/release/policy.mjs';
import {admitHosted} from '../scripts/release/hosted-admission.mjs';
import {hostedFixture} from '../scripts/release/hosted-fixture.mjs';
const sha='a'.repeat(40),sum='b'.repeat(64);
function fixture(){
 const e={candidate:sha,sourceRevision:sha,sourceHash:sum,identity:{schema:sum},preflight:{state:'current-compatible-ledger',track:'baseline',ledgerHash:sum},build:{status:'passed',digest:sum},tests:{candidate:sha,status:'passed',count:907,failed:0,applicationSmoke:'passed'},run:'123'};
 return hostedFixture(makeManifest(e),makeManifest({...e,sourceRevision:'c'.repeat(40),sourceHash:'d'.repeat(64),build:{status:'passed',digest:'e'.repeat(64)}}));
}
const run=(f:ReturnType<typeof fixture>,role='candidate')=>admitHosted({...f,role,manifest:f.pin.releases[role].manifest});
test('synthetic candidate rollback candidate each requires independent provenance',async()=>{
 const f=fixture();for(const role of ['candidate','rollback','candidate']){const receipt=await run(f,role);assert.equal(receipt.role,role);assert.equal(receipt.mode,'synthetic-only');}
});
const failures: [string,(f:ReturnType<typeof fixture>)=>void][]=[
 ['candidate SHA',f=>{f.workflow.headSha='f'.repeat(40);}],
 ['deployment id',f=>{f.deployments['synthetic-candidate'].id='other';}],
 ['project',f=>{f.deployments['synthetic-candidate'].projectId='other';}],
 ['environment',f=>{f.deployments['synthetic-candidate'].environment='production';}],
 ['missing manifest',f=>{f.pin.releases.candidate.manifest=null;}],
 ['stale manifest',f=>{f.now=f.pin.expiresAt;}],
 ['checksum',f=>{f.pin.releases.candidate.manifest.checksum='f'.repeat(64);}],
 ['rollback substituted',f=>{f.pin.releases.candidate.manifest=f.pin.releases.rollback.manifest;}],
 ['migration receipt',f=>{f.migration.receipt={...f.migration.receipt,ledgerHash:'f'.repeat(64)};}],
 ['unadmitted build',f=>{f.deployments['synthetic-candidate'].admissionId='none';}],
 ['production inventory',f=>{f.target.environment='production';}],
 ['custom domain',f=>{Object.assign(f.target,{customDomains:['example.com']});}],
 ['unknown database',f=>{f.target.databaseClassification='unknown';}],
 ['live provider',f=>{f.provider.kind='vercel';}],
 ['expired artifact',f=>{f.artifact.expired=true;}],
 ['failed CI',f=>{f.workflow.conclusion='failure';}],
 ['wrong run',f=>{f.artifact.runId='456';}],
 ['changed artifact bytes',f=>{f.artifact.manifests.candidate.build.digest='f'.repeat(64);}],
 ['wrong build',f=>{f.deployments['synthetic-candidate'].buildDigest='f'.repeat(64);}],
 ['stale database read',f=>{f.migration.checkedAt--;}],
 ['wrong schema',f=>{f.migration.identityHash='f'.repeat(64);}],
];
for(const [name,mutate] of failures)test('hosted admission rejects '+name,async()=>{const f=fixture();mutate(f);await assert.rejects(run(f));});
test('candidate cannot substitute rollback',async()=>{const f=fixture();f.pin.releases.rollback.manifest=f.pin.releases.candidate.manifest;await assert.rejects(run(f,'rollback'));});
test('audit never copies arbitrary provider secrets',async()=>{const f=fixture();Object.assign(f.deployments['synthetic-candidate'],{token:'do-not-log'});assert.ok(!JSON.stringify(await run(f)).includes('do-not-log'));});

test('rejection never exposes provider error or unexpected secret fields',async()=>{const f=fixture();Object.assign(f.target,{token:'do-not-log'});await assert.rejects(run(f),error=>{assert.ok(!String(error).includes('do-not-log'));return true;});f.provider.target=async()=>{throw Error('secret-provider-token');};await assert.rejects(run(f),error=>{assert.ok(!String(error).includes('secret-provider-token'));return true;});});
