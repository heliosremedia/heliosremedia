import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {admitHosted} from './hosted-admission.mjs';
import {hostedFixture} from './hosted-fixture.mjs';
import {canonical} from './policy.mjs';
// Run only after the actual Packet12 complete evidence-set validator succeeds.
execFileSync(process.execPath,['scripts/release/verify-artifacts.mjs'],{stdio:'inherit'});
const read=async role=>JSON.parse(await readFile('release-evidence/'+role+'-manifest.json','utf8'));
const candidate=await read('candidate'),rollback=await read('prior');
const f=hostedFixture(candidate,rollback,Date.now());
const receipts=[];
for(const role of ['candidate','rollback','candidate'])receipts.push(await admitHosted({...f,role,manifest:f.pin.releases[role].manifest}));
assert.notEqual(receipts[0].deploymentId,receipts[1].deploymentId);
assert.equal(receipts[0].manifestChecksum,receipts[2].manifestChecksum);
for(const [role,wrong] of [['candidate',rollback],['rollback',candidate]])await assert.rejects(admitHosted({...f,role,manifest:wrong}));
await writeFile('release-evidence/hosted-synthetic.json',canonical({version:1,mode:'synthetic-only',candidate:candidate.candidate,run:candidate.run,status:'passed',liveDeployment:false,liveRollback:false,receipts})+'\n');
console.log('PASS synthetic hosted admission: actual release manifests, mocked provider metadata; no hosted deployment');
