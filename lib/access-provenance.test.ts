import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryVercel,qualifyProvenance} from '../scripts/release/access-provenance.mjs';
const sha='a'.repeat(40),digest='b'.repeat(64);
function fixture(){return {
 project:{id:'prj_test',accountId:'team_test'},
 deployment:{id:'dpl_test',projectId:'prj_test',ownerId:'team_test',target:null,readyState:'READY',createdAt:100,alias:[],url:'synthetic.vercel.app',gitSource:{sha}},domains:[],
 expected:{teamId:'team_test',projectId:'prj_test',deploymentId:'dpl_test',databaseId:'db_test',role:'candidate',sourceSha:sha,manifestDigest:digest,notBefore:90},
 database:{id:'db_test',ownerTeamId:'team_test',classification:'isolated-non-production',isolationVerified:true,disposable:true,providers:'synthetic-only',checkedAt:110,schemaHash:digest,ledgerHash:digest,ledgerState:'current-compatible-ledger'},
 artifactProof:{role:'candidate',deploymentId:'dpl_test',manifestDigest:digest,sourceSha:sha,authenticatedUploadReceipt:true},observedAt:110,now:120,
};}
test('missing credentials makes zero network calls and stays blocked',async()=>{let calls=0;const r=await inventoryVercel({token:'',teamId:'team_test',fetchImpl:async()=>{calls++;throw Error('must not call');}});assert.equal(calls,0);assert.equal(r.reason,'NO_CREDENTIALS');assert.equal(r.deployable,false);});
test('empty projects reproduces connected access blocker without logging raw data',async()=>{const calls: {url:string;method?:string;redirect?:string}[]=[];const replies=[{teams:[{id:'team_test'}]},{projects:[],pagination:{count:0},token:'secret'}];const r=await inventoryVercel({token:'secret',teamId:'team_test',fetchImpl:async(url,options)=>{calls.push({url:String(url),method:options?.method,redirect:options?.redirect});return Response.json(replies.shift());}});assert.equal(r.reason,'PROJECT_NOT_VISIBLE');assert.deepEqual(calls.map(x=>x.method),['GET','GET']);assert.ok(calls.every(x=>x.url.startsWith('https://api.vercel.com/')&&x.redirect==='error'));assert.ok(!JSON.stringify(r).includes('secret'));});
for(const [name,replies,reason] of [
 ['wrong team',[{teams:[{id:'team_other'}]}],'TEAM_NOT_VISIBLE'],
 ['partial response',[{}],'PARTIAL_METADATA'],
 ['visible project remains unqualified',[{teams:[{id:'team_test'}]},{projects:[{id:'prj_test',env:[{value:'secret'}]}]}],'TARGET_QUALIFICATION_REQUIRED'],
 ['pagination incomplete',[{teams:[{id:'team_test'}]},{projects:[],pagination:{next:123}}],'INCOMPLETE_INVENTORY'],
] as const)test(name,async()=>{let index=0;const r=await inventoryVercel({token:'secret',teamId:'team_test',fetchImpl:async()=>Response.json(replies[index++])});assert.equal(r.reason,reason);assert.equal(r.deployable,false);assert.ok(!JSON.stringify(r).includes('secret'));});
for(const status of [401,403,404,429,500])test('provider status '+status+' fails closed without retry',async()=>{let calls=0;const r=await inventoryVercel({token:'secret',teamId:'team_test',fetchImpl:async()=>{calls++;return new Response('secret',{status});}});assert.equal(calls,1);assert.equal(r.deployable,false);assert.ok(!JSON.stringify(r).includes('secret'));});
test('network and JSON never-settlement are bounded and never retry',async()=>{for(const stage of ['fetch','json']){let calls=0;const r=await inventoryVercel({token:'secret',teamId:'team_test',timeoutMs:5,fetchImpl:async()=>{calls++;if(stage==='fetch')await new Promise(()=>{});return Object.assign(new Response(),{json:async()=>await new Promise(()=>{})});}});assert.equal(r.reason,'PROVIDER_UNAVAILABLE');assert.equal(calls,1);}});
test('unsafe request identifiers never enter URLs',async()=>{const r=await inventoryVercel({token:'secret',teamId:'../../env',fetchImpl:async()=>{throw Error('must not call');}});assert.equal(r.reason,'TEAM_REQUIRED');});
test('consistent snapshots do not authenticate themselves or enable deployment',()=>{const r=qualifyProvenance(fixture());assert.equal(r.result,'metadata-consistent');assert.equal(r.mode,'snapshot-validation-only');assert.equal(r.deployable,false);});
const failures:[string,(f:ReturnType<typeof fixture>)=>void,string][]=[
 ['deployment not found',f=>{Object.assign(f,{deployment:null});},'DEPLOYMENT_NOT_FOUND'],
 ['wrong project',f=>{f.deployment.projectId='prj_other';},'PROJECT_MISMATCH'],
 ['wrong team',f=>{f.project.accountId='team_other';},'TEAM_MISMATCH'],
 ['production environment',f=>{Object.assign(f.deployment,{target:'production'});},'PRODUCTION_ENVIRONMENT'],
 ['unknown environment',f=>{Object.assign(f.deployment,{target:undefined});},'UNKNOWN_ENVIRONMENT'],
 ['production alias',f=>{Object.assign(f.deployment,{alias:['production.example']});},'DOMAIN_OR_ALIAS_PRESENT'],
 ['production project domain',f=>{Object.assign(f,{domains:['production.example']});},'DOMAIN_OR_ALIAS_PRESENT'],
 ['wrong source',f=>{f.deployment.gitSource.sha='c'.repeat(40);},'SOURCE_MISMATCH'],
 ['stale deployment',f=>{f.deployment.createdAt=1;},'STALE_DEPLOYMENT'],
 ['wrong artifact role',f=>{f.artifactProof.role='rollback';},'ROLE_MISMATCH'],
 ['wrong database',f=>{f.database.id='db_other';},'DATABASE_MISMATCH'],
 ['unknown database',f=>{f.database.classification='unknown';},'DATABASE_UNKNOWN'],
 ['production database',f=>{f.database.classification='production';},'PRODUCTION_DATABASE'],
 ['missing metadata',f=>{Object.assign(f.deployment,{alias:undefined});},'PARTIAL_METADATA'],
 ['stale observation',f=>{f.now=70000;},'STALE_OBSERVATION'],
 ['unproven upload',f=>{f.artifactProof.authenticatedUploadReceipt=false;},'ARTIFACT_CORRELATION_MISSING'],
 ['wrong deployment',f=>{f.deployment.id='dpl_other';},'DEPLOYMENT_MISMATCH'],
 ['production providers',f=>{f.database.providers='production';},'DATABASE_UNKNOWN'],
];
for(const [name,change,reason] of failures)test('access qualification rejects '+name,()=>{const f=fixture();change(f);const r=qualifyProvenance(f);assert.equal(r.reason,reason);assert.equal(r.deployable,false);});
test('receipts exclude arbitrary secrets and mutable meta does not replace git source',()=>{const f=fixture();Object.assign(f.deployment,{token:'secret',meta:{sourceSha:sha}});f.deployment.gitSource.sha='wrong';const r=qualifyProvenance(f);assert.equal(r.reason,'SOURCE_MISMATCH');assert.ok(!JSON.stringify(r).includes('secret'));});
test('rollback expected role cannot accept candidate receipt',()=>{const f=fixture();f.expected.role='rollback';assert.equal(qualifyProvenance(f).reason,'ROLE_MISMATCH');});
test('actual CLI stops without credentials and emits only safe receipt',async()=>{const {spawnSync}=await import('node:child_process');const r=spawnSync(process.execPath,['scripts/release/access-inventory-cli.mjs'],{encoding:'utf8',env:{PATH:process.env.PATH,NODE_ENV:"test"}});assert.equal(r.status,2);const receipt=JSON.parse(r.stdout);assert.equal(receipt.reason,'NO_CREDENTIALS');assert.equal(receipt.deployable,false);assert.equal(r.stderr,'');});
