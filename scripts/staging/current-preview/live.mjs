import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {TARGET,ENVIRONMENT,protection,targetConnection,jsonGet} from '../policy.mjs';
import {HOSTED,BRANCH,CONFIG_KEYS,invocation,qualifiedRun,project,apiClient,ignore,createRequest,deployment} from './policy.mjs';
import {environmentInventory} from '../actions/policy.mjs';
import {hostnameBindings} from '../hosted-policy.mjs';
import {databaseState} from '../hosted-build.mjs';
import {observeOwnerState,ownerPasswords} from '../owner-credentials.mjs';
import {ownerAuth} from '../owner-auth.mjs';
import {fixtureAdmission,authTransition} from './fixture.mjs';
import {executePreview} from './execute.mjs';
import {qualifyOwners} from './http.mjs';
import {digest} from '../../release/policy.mjs';
import {eventsSummary} from '../actions/diagnostics.mjs';
let db,phase='invocation',bindings=[],original;
const e=process.env,marker='studio-owner-preview-'+e.GITHUB_RUN_ID,p='/v9/projects/'+HOSTED.project;
try{
 const candidate=invocation(e,execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());execFileSync('git',['diff','--quiet','HEAD','--'],{stdio:'ignore'});
 const api=apiClient(e.STAGING_VERCEL_TOKEN,candidate,marker),secret=randomBytes(48).toString('hex');
 const manifest=JSON.parse(await readFile('scripts/migrations/bootstrap/history-sha256.json','utf8'));
 async function suppress(){assert.equal((await api(p)).id,HOSTED.project);await api(p,'PATCH',{commandForIgnoringBuildStep:'exit 0'});assert.equal((await api(p)).commandForIgnoringBuildStep,'exit 0');}
 async function unconfigure(){const rows=(await api(p+'/env')).envs;for(const row of rows)if(row.comment===marker&&row.gitBranch===BRANCH&&JSON.stringify(row.target)==='["preview"]')await api(p+'/env/'+encodeURIComponent(row.id),'DELETE');const remaining=(await api(p+'/env')).envs;assert.ok(!remaining.some(r=>r.comment===marker));}
 async function unbind(){if(!bindings.length)return;await db.query('BEGIN');try{for(const b of bindings){const r=await db.query('UPDATE "WorkspaceDomain" SET hostname=$1 WHERE "workspaceId"=$2 AND hostname=$3',[b.workspaceId+'.example.test',b.workspaceId,b.hostname]);assert.equal(r.rowCount,1);}await db.query('COMMIT');bindings=[];}catch(error){await db.query('ROLLBACK');throw error;}}
 if(process.argv[2]==='--restore-suppression'){
  const journal=JSON.parse(await readFile('staging-evidence/current-preview-restoration.json','utf8'));assert.equal(journal.run,e.GITHUB_RUN_ID);assert.equal(journal.executor,e.GITHUB_SHA);await suppress();console.log('CURRENT_OWNER_PREVIEW_SUPPRESSION_RESTORED');
 }else{
  assert.equal(process.argv.length,2);phase='credential-input';const passwords=ownerPasswords([e.STAGING_OWNER_PASSWORD_A,e.STAGING_OWNER_PASSWORD_B]);
  phase='execution';await executePreview({
   preflight:async()=>{
    const gh=e.STAGING_GITHUB_READ_TOKEN||e.GITHUB_TOKEN,g='https://api.github.com/repos/heliosremedia/heliosremedia';
    protection(await jsonGet(g+'/environments/'+ENVIRONMENT,gh),await jsonGet(g+'/environments/'+ENVIRONMENT+'/deployment-branch-policies',gh));
    qualifiedRun(await jsonGet(g+'/actions/runs/'+e.STAGING_RELEASE_RUN_ID,gh),candidate,'.github/workflows/v2-regression.yml',{integration:true});
    // Rehearsal may be on the qualified feature candidate with identical application
    // bytes. Its candidate is separately statically pinned in the executor.
    qualifiedRun(await jsonGet(g+'/actions/runs/'+e.STAGING_PREVIEW_REHEARSAL_RUN,gh),e.STAGING_PREVIEW_REHEARSAL_SHA,'.github/workflows/v2-current-staging-upgrade.yml');
    const comparison=await jsonGet(g+'/compare/'+e.STAGING_PREVIEW_REHEARSAL_SHA+'...'+candidate,gh);
    assert.ok(Array.isArray(comparison.files)&&comparison.files.every(f=>f.filename.startsWith('docs/')),'Rehearsal and deployment execution bytes differ');
    project(await api(p),await api(p+'/domains'));environmentInventory((await api(p+'/env')).envs);
    const n='https://console.neon.tech/api/v2/projects/'+TARGET.project,t=e.STAGING_NEON_API_KEY;
    const [np,nb,ne,nd]=await Promise.all([jsonGet(n,t),jsonGet(n+'/branches/'+TARGET.branch,t),jsonGet(n+'/endpoints',t),jsonGet(n+'/branches/'+TARGET.branch+'/databases',t)]);
    db=new pg.Client(targetConnection({project:np.project,branch:nb.branch,endpoints:ne.endpoints,databases:nd.databases},e.STAGING_DIRECT_URL));await db.connect();
    assert.equal((await db.query('SELECT pg_try_advisory_lock(1200320) locked')).rows[0].locked,true);
    original=await observeOwnerState(db);await fixtureAdmission(original,passwords,await ownerAuth());
    const before=await databaseState(db,manifest,'current-studio');
    await mkdir('staging-evidence',{recursive:true});await writeFile('staging-evidence/current-preview-restoration.json',JSON.stringify({run:e.GITHUB_RUN_ID,executor:e.GITHUB_SHA}));return before;
   },
   configure:async()=>{
    const vars={DATABASE_URL:e.STAGING_DIRECT_URL,DIRECT_URL:e.STAGING_DIRECT_URL,AUTH_SECRET:secret,STUDIO_V2_TENANT_CONTEXT_ENABLED:'true',STUDIO_V2_SHELL_ENABLED:'true',STUDIO_V2_SHELL_WORKSPACE_IDS:'packet16-a,packet16-b',STAGING_SCHEMA_PROFILE:'current-studio',STAGING_HOSTED_ADMISSION:'preview-only',STAGING_CANDIDATE_SHA:candidate,STAGING_RELEASE_RUN_ID:e.STAGING_RELEASE_RUN_ID,STAGING_VERCEL_READ_TOKEN:e.STAGING_VERCEL_TOKEN,STAGING_GITHUB_READ_TOKEN:e.STAGING_GITHUB_READ_TOKEN||e.GITHUB_TOKEN,STAGING_NEON_API_KEY:e.STAGING_NEON_API_KEY,VERCEL_ORG_ID:HOSTED.team,VERCEL_PROJECT_ID:HOSTED.project};assert.deepEqual(Object.keys(vars).sort(),[...CONFIG_KEYS].sort());
    for(const [key,value] of Object.entries(vars)){const row=await api('/v10/projects/'+HOSTED.project+'/env','POST',{key,value,type:['STAGING_CANDIDATE_SHA','VERCEL_PROJECT_ID'].includes(key)?'plain':'encrypted',target:['preview'],gitBranch:BRANCH,comment:marker});assert.ok(row.id||row.created);}
    await api(p,'PATCH',{commandForIgnoringBuildStep:ignore(candidate)});assert.equal((await api(p)).commandForIgnoringBuildStep,ignore(candidate));
   },
   create:()=>api('/v13/deployments','POST',createRequest(candidate)),
   wait:async id=>{for(let i=0;i<90;i++){const d=await api('/v13/deployments/'+id);deployment(d,candidate,id);if(['READY','ERROR','CANCELED'].includes(d.readyState))return d;await new Promise(r=>setTimeout(r,10000));}throw Error('Build timeout');},
   receipt:async id=>{
    const events=await api('/v3/deployments/'+id+'/events');assert.ok(Array.isArray(events));const lines=events.map(x=>x.text||x.payload?.text||'').filter(x=>x.startsWith('STAGING_BUILD_RECEIPT '));assert.equal(lines.length,1);
    const raw=JSON.parse(lines[0].slice('STAGING_BUILD_RECEIPT '.length)),{checksum,...body}=raw;assert.equal(digest(body),checksum);
    assert.equal(raw.candidate,candidate);assert.equal(raw.deployment,id);assert.equal(raw.project,HOSTED.project);assert.equal(raw.team,HOSTED.team);assert.equal(raw.environment,'preview');assert.equal(raw.schemaProfile,'current-studio');assert.equal(raw.tests.run,Number(e.STAGING_RELEASE_RUN_ID));assert.deepEqual(raw.database,TARGET);assert.equal(raw.schemaHash,original.schemaHash);assert.equal(raw.ledgerHash,(await databaseState(db,manifest,'current-studio')).ledgerHash);assert.match(raw.buildDigest,/^[a-f0-9]{64}$/);
    return {candidate,deployment:id,checksum,buildDigest:raw.buildDigest,schemaHash:raw.schemaHash,ledgerHash:raw.ledgerHash};
   },
   bind:async d=>{
    const hosts=[...new Set([d.url,...(d.alias||[])])];assert.ok(hosts.length>=2);const plan=hostnameBindings(d,['packet16-a','packet16-b'].map((workspaceId,i)=>({workspaceId,hostname:hosts[i]})));
    await db.query('BEGIN');try{for(const b of plan){const r=await db.query('UPDATE "WorkspaceDomain" SET hostname=$1 WHERE "workspaceId"=$2 AND hostname=$3',[b.hostname,b.workspaceId,b.workspaceId+'.example.test']);assert.equal(r.rowCount,1);}await db.query('COMMIT');bindings=plan;return plan;}catch(error){await db.query('ROLLBACK');throw error;}
   },
   qualify:plan=>qualifyOwners(plan,passwords,e.STAGING_VERCEL_BYPASS_SECRET),suppress,unconfigure,unbind,
   postflight:async qualified=>{
    const after=await observeOwnerState(db);if(qualified)authTransition(original,after,bindings);else{assert.equal(after.schemaHash,original.schemaHash);assert.deepEqual(after.ledger,original.ledger);}
    return databaseState(db,manifest,'current-studio');
   },
   events:async id=>eventsSummary(await api('/v3/deployments/'+id+'/events')),
   persist:async result=>{await mkdir('staging-evidence',{recursive:true});await writeFile('staging-evidence/current-owner-preview.json',JSON.stringify(result,null,2)+'\n');},
  },{candidate,executor:e.GITHUB_SHA});console.log('CURRENT_OWNER_PREVIEW_QUALIFIED: persistent synthetic owner testing only; production on hold');
 }
}catch{console.error('CURRENT_OWNER_PREVIEW_BLOCKED: '+phase+'; inspect safe receipt; no automatic redeployment or repair');process.exitCode=1;}
finally{if(db)await db.end().catch(()=>{});}
