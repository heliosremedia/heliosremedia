import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {head,preflight,stateEvidence} from './gate.mjs';
import {verifyManifest} from './policy.mjs';
const read=async name=>JSON.parse(await readFile('release-evidence/'+name+'.json','utf8'));
const context=JSON.parse(await readFile('.packet12-context.json','utf8'));
const final=await read('application');assert.equal(final.candidate,head());assert.equal(final.status,'passed');assert.equal(final.ledgerStable,true);assert.deepEqual(final.chromium,[390,1440]);
const tests=await read('tests');assert.equal(tests.candidate,head());
const result=await preflight(context);
assert.deepEqual(final.manifests.map(m=>m.name).sort(),['candidate','prior']);
for(const {name,checksum} of final.manifests){
 const manifest=await read(name+'-manifest');assert.equal(manifest.checksum,checksum);
 verifyManifest(manifest,{...manifest,candidate:head(),identity:result.identity,preflight:stateEvidence(result,context.database),tests:{...tests,applicationSmoke:'passed'},run:process.env.GITHUB_RUN_ID||'local-isolated'});
 if(name==='candidate')assert.equal(manifest.sourceRevision,head());
}
console.log('PASS complete release evidence set for',head(),tests.count,'tests; isolated admission only');
