import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {preflight,treeDigest,generatedClientCheck,stateEvidence,head} from './gate.mjs';
import {makeManifest,verifyManifest,canonical,digest} from './policy.mjs';

// Only the isolated application harness imports this. It cannot route to hosted targets.
export async function applicationGate(){
 const context=JSON.parse(await readFile('.packet12-context.json','utf8'));
 const tests=JSON.parse(await readFile('release-evidence/tests.json','utf8'));
 assert.equal(context.candidate,head());assert.equal(tests.candidate,head());
 assert.equal(tests.status,'passed');assert.equal(tests.failed,0);assert.ok(tests.count>0);
 const run=process.env.GITHUB_RUN_ID||'local-isolated';
 const records=new Map();
 const check=()=>preflight(context);
 const buildDigest=dir=>treeDigest(join(dir,'.next'),{exclude:['cache','trace','trace-build','diagnostics']});
 const sourceDigest=dir=>treeDigest(dir,{exclude:['node_modules','.next','next-env.d.ts','tsconfig.tsbuildinfo']});
 return {
  async beforeBuild(name,dir,sourceRevision){
   assert.ok(!records.has(name));
   const result=await check();await generatedClientCheck(dir);
   assert.equal(await readFile(join(dir,'prisma/schema.prisma'),'utf8'),await readFile('prisma/schema.prisma','utf8'));
   const record={candidate:context.candidate,sourceRevision,sourceHash:await sourceDigest(dir),identity:result.identity,preflight:stateEvidence(result,context.database),tests,run,dir};
   records.set(name,record);console.log('PASS release preflight before build',name,sourceRevision,result.track);
  },
  async afterBuild(name){
   const r=records.get(name);assert.ok(r);assert.equal(await sourceDigest(r.dir),r.sourceHash,'Build changed application input');
   const result=await check();assert.deepEqual(stateEvidence(result,context.database),r.preflight);
   r.build={status:'passed',digest:await buildDigest(r.dir)};
  },
  async qualify(name,origin,cookie){
   const r=records.get(name);assert.ok(r?.build);
   assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
   assert.equal((await fetch(origin+'/api/rehearsal-state')).status,401);
   const response=await fetch(origin+'/api/rehearsal-state',{headers:{cookie}});assert.equal(response.status,200);const state=await response.json();assert.equal(state.settings.businessName,'REHEARSAL COMPANY a');
   r.tests={...tests,applicationSmoke:'passed'};
   r.manifest=makeManifest(r);
   assert.equal(canonical(r.manifest),canonical(makeManifest(r)),'Manifest must be deterministic for same inputs');
   await writeFile('release-evidence/'+name+'-manifest.json',canonical(r.manifest)+'\n');
  },
  async admit(name){
   const r=records.get(name);assert.ok(r?.manifest,'Unqualified candidate cannot be promoted');
   const result=await check();
   const current={...r,preflight:stateEvidence(result,context.database),identity:result.identity,build:{status:'passed',digest:await buildDigest(r.dir)}};
   verifyManifest(JSON.parse(await readFile('release-evidence/'+name+'-manifest.json','utf8')),current);
   console.log('PASS promotion admission',name,r.sourceRevision,r.manifest.checksum);
  },
  async negatives(){
   for(const [name,r] of records){
    for(const field of ['candidate','sourceRevision','sourceHash','identity','preflight','build','tests','run']){
     const altered=structuredClone(r.manifest);altered[field]=field==='candidate'?'0'.repeat(40):{stale:true};
     const {checksum:_,...payload}=altered;void _;altered.checksum=digest(payload);
     assert.throws(()=>verifyManifest(altered,r),'Recomputed digest must not disguise stale '+field);
    }
    const opposite=records.get(name==='prior'?'candidate':'prior');assert.throws(()=>verifyManifest(opposite.manifest,r));
   }
   console.log('PASS stale/mismatched/rollback artifact cannot be promoted');
  },
  async finish(){
   await this.admit('prior');await this.admit('candidate');
   await writeFile('release-evidence/application.json',canonical({candidate:context.candidate,run,status:'passed',chromium:[390,1440],ledgerStable:true,promotion:'prior-candidate-rollback-candidate',manifests:[...records].map(([name,r])=>({name,checksum:r.manifest.checksum}))})+'\n');
  },
 };
}
