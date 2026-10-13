// Disposable PostgreSQL + actual password implementation; provider/HTTP effects
// are injected, so this receipt cannot qualify a hosted URL or ordinary HTTP login.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {databaseUrl} from '../../migrations/bootstrap/artifact.mjs';
import {ownerAuth} from '../owner-auth.mjs';
import {observeOwnerState} from '../owner-credentials.mjs';
import {fixtureAdmission,authTransition} from './fixture.mjs';
import {executePreview} from './execute.mjs';
import {HOSTED,BRANCH} from './policy.mjs';
assert.equal(process.env.STUDIO_STAGING_UPGRADE,'isolated-only');assert.equal(process.env.PACKET11_REHEARSAL,'isolated-only');
for(const key of ['STAGING_DIRECT_URL','STAGING_VERCEL_TOKEN','STAGING_NEON_API_KEY','VERCEL','HELIOS_RELEASE_TARGET'])assert.ok(!process.env[key]);
const db=new pg.Client({connectionString:databaseUrl('packet11_clean')}),passwords=['synthetic-owner-a-password-only','synthetic-owner-b-password-only'];
const candidate=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),auth=await ownerAuth();
try{
 await db.connect();const original=await observeOwnerState(db);await fixtureAdmission(original,passwords,auth);
 await assert.rejects(fixtureAdmission(original,[passwords[1],passwords[0]],auth),/Stored credential mismatch/);
 const changed=structuredClone(original);changed.data.AdminUser[0].sessionVersion=1;await assert.rejects(fixtureAdmission(changed,passwords,auth));
 const bindings=['packet16-a','packet16-b'].map((workspaceId,i)=>({workspaceId,hostname:'helios-v2-staging-fixture-'+i+'.vercel.app'}));
 const d={id:'dpl_fixture',projectId:HOSTED.project,ownerId:HOSTED.team,target:null,readyState:'READY',url:bindings[0].hostname,alias:[bindings[1].hostname],gitSource:{type:'github',repoId:HOSTED.repository,ref:BRANCH,sha:candidate}};
 let receipt;
 await executePreview({
  preflight:async()=>({schemaHash:original.schemaHash}),configure:async()=>{},create:async()=>d,wait:async()=>d,receipt:async()=>({synthetic:true}),
  bind:async()=>{for(const b of bindings)assert.equal((await db.query('UPDATE "WorkspaceDomain" SET hostname=$1 WHERE "workspaceId"=$2',[b.hostname,b.workspaceId])).rowCount,1);return bindings;},
  qualify:async()=>{
   for(const b of bindings){const id=b.workspaceId;await db.query('UPDATE "AdminUser" SET "lastLoginAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1',[id+'-owner']);
    for(const [i,action] of ['AUTH_LOGIN_FAILED','AUTH_LOGIN_SUCCEEDED','AUTH_LOGIN_SUCCEEDED','AUTH_LOGOUT','AUTH_LOGOUT'].entries())await db.query('INSERT INTO "AuditEvent" (id,"workspaceId","actorId","actorEmail",action,"entityType","entityId",summary) VALUES ($1,$2,$3,$4,$5,\'AdminUser\',$3,\'Synthetic isolated auth transition\')',[id+'-auth-'+i,id,id+'-owner',id+'@example.test',action]);
   }return {simulatedHTTP:true};
  },suppress:async()=>{},unconfigure:async()=>{},unbind:async()=>{throw Error('Successful synthetic flow must retain bindings');},
  postflight:async()=>{const after=await observeOwnerState(db);authTransition(original,after,bindings);const unexpected=structuredClone(after);unexpected.data.Project[0].title='foreign-change';assert.throws(()=>authTransition(original,unexpected,bindings));return {schemaHash:after.schemaHash};},events:async()=>[],
  persist:async r=>{receipt=r;},
 },{candidate,executor:candidate});
 assert.equal(receipt.success,true);assert.equal(receipt.testingURLs.length,2);
 const after=await observeOwnerState(db);for(let i=0;i<2;i++)assert.equal(await auth.verifyPassword(passwords[i],after.data.AdminUser.find(r=>r.id===bindings[i].workspaceId+'-owner').passwordHash),true);
 await mkdir('staging-evidence',{recursive:true});
 await writeFile('staging-evidence/current-preview-isolated.json',JSON.stringify({version:1,candidate,result:'passed',mode:'disposable-postgresql-simulated-provider-and-http-effects',schemaHash:after.schemaHash,ledgerEntries:after.ledger.length,schemaLedgerUnchanged:true,persistentPasswordsUnchanged:true,storedAuthTransitionVerified:true,unrelatedMutationRejected:true,foreignPasswordRejected:true,retentionAfterCleanupVerified:true,hosted:false,ownerAccessQualified:false,deployable:false},null,2)+'\n');
 console.log('CURRENT_OWNER_PREVIEW_REHEARSAL_PASSED: simulated provider/HTTP effects; no hosted URL qualified');
}finally{await db.end().catch(()=>{});}
