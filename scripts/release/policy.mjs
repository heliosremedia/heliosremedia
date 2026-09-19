import assert from 'node:assert/strict';
import {hash,BASELINE} from '../migrations/bootstrap/inspect.mjs';
export const BASELINE_CHECKSUM='6eb3e3af3536ec58df86fcdf5739c2b07dc1664263410c06ceed012c6c6e3dbb';
export const HISTORICAL_SCHEMA='70c4d61075f9882bb9dceea516447538a0c3fa22b1472299b8306a1d4d9d7c6c';
export const CURRENT_SCHEMA='500be0f2b2b62093876525ee61994200aa822fefd7f47e41dfffdba6ec0f7dad';
export function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export const digest=value=>hash(canonical(value));
export function requireCandidate(value){assert.match(value,/^[0-9a-f]{40}$/,'Explicit candidate SHA required');return value;}
export function admission(state,selected){
 const rules={
  'clean-bootstrap':['clean-bootstrap-candidate',null],
  'verified-baseline':['supported-historical-ledger','baseline'],
  'historical-ledger':['supported-historical-ledger','historical'],
  'current-baseline':['current-compatible-ledger','baseline'],
  'current-historical':['current-compatible-ledger','historical'],
 };
 if(state.state==='verified-historical-without-ledger')throw Error('Explicit reviewed baseline establishment required; release never runs migrate resolve');
 assert.ok(Object.hasOwn(rules,selected),'Unknown selected track');
 assert.deepEqual([state.state,state.track],rules[selected],'Database does not match selected track');
 return selected.includes('historical')?'historical':'baseline';
}
export function makeManifest({candidate,sourceRevision,sourceHash,identity,preflight,build,tests,run}){
 requireCandidate(candidate);requireCandidate(sourceRevision);
 assert.equal(preflight.state,'current-compatible-ledger');
 assert.ok(['baseline','historical'].includes(preflight.track));
 assert.equal(build.status,'passed');assert.equal(tests.status,'passed');
 assert.match(build.digest,/^[a-f0-9]{64}$/);assert.match(sourceHash,/^[a-f0-9]{64}$/);
 assert.equal(tests.applicationSmoke,'passed');assert.equal(tests.candidate,candidate);assert.ok(tests.count>0);assert.equal(tests.failed,0);
 const payload={version:1,target:'isolated-postgresql16',candidate,sourceRevision,sourceHash,identity,preflight,build,tests,run};
 return {...payload,checksum:digest(payload)};
}
export function verifyManifest(manifest,expected){
 const {checksum,...payload}=manifest;
 assert.equal(checksum,digest(payload),'Manifest integrity mismatch');
 assert.equal(payload.version,1);assert.equal(payload.target,'isolated-postgresql16');
 for(const key of ['candidate','sourceRevision','sourceHash','identity','preflight','build','tests','run'])assert.equal(canonical(payload[key]),canonical(expected[key]),'Stale or mismatched '+key);
 makeManifest(payload);
 return true;
}
export const baselineIdentity={version:BASELINE,checksum:BASELINE_CHECKSUM};
