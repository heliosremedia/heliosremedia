// Protected initialization only. No migration, deployment or session bypass.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {TARGET,ENVIRONMENT,protection,targetConnection,jsonGet} from './policy.mjs';
import {qualifiedUpgradeRun} from './current-upgrade-invocation.mjs';
import {ownerInvocation} from './owner-invocation.mjs';
import {ownerPasswords,initializeOwners} from './owner-credentials.mjs';
import {ownerAuth} from './owner-auth.mjs';
let db,phase='invocation';
try{
 const e=process.env,candidate=ownerInvocation(e,execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
 execFileSync('git',['diff','--quiet','HEAD','--'],{stdio:'ignore'});
 phase='credential-input';const passwords=ownerPasswords([e.STAGING_OWNER_PASSWORD_A,e.STAGING_OWNER_PASSWORD_B]);
 phase='protected-source-admission';const api='https://api.github.com/repos/heliosremedia/heliosremedia',token=e.STAGING_GITHUB_READ_TOKEN||e.GITHUB_TOKEN;
 protection(await jsonGet(api+'/environments/'+ENVIRONMENT,token),await jsonGet(api+'/environments/'+ENVIRONMENT+'/deployment-branch-policies',token));
 for(const [id,path] of [[e.STAGING_REGRESSION_RUN,'.github/workflows/v2-regression.yml'],[e.STAGING_OWNER_REHEARSAL_RUN,'.github/workflows/v2-current-staging-upgrade.yml']])qualifiedUpgradeRun(await jsonGet(api+'/actions/runs/'+id,token),candidate,path);
 phase='target-admission';const n='https://console.neon.tech/api/v2/projects/'+TARGET.project,t=e.STAGING_NEON_API_KEY;
 const [p,b,endpoints,databases]=await Promise.all([jsonGet(n,t),jsonGet(n+'/branches/'+TARGET.branch,t),jsonGet(n+'/endpoints',t),jsonGet(n+'/branches/'+TARGET.branch+'/databases',t)]);
 db=new pg.Client(targetConnection({project:p.project,branch:b.branch,endpoints:endpoints.endpoints,databases:databases.databases},e.STAGING_DIRECT_URL));await db.connect();
 assert.equal((await db.query('SELECT current_database() name')).rows[0].name,TARGET.database);
 assert.equal(Math.floor(Number((await db.query('SHOW server_version_num')).rows[0].server_version_num)/10000),16);
 phase='atomic-initialization';const receipt=await initializeOwners(db,passwords,await ownerAuth());
 phase='retain-receipt';await mkdir('staging-evidence',{recursive:true});
 await writeFile('staging-evidence/owner-credentials-live.json',JSON.stringify({...receipt,candidate,executor:e.GITHUB_SHA,target:TARGET,observedAt:new Date().toISOString()},null,2)+'\n');
 console.log('STAGING_OWNER_CREDENTIALS_INITIALIZED: ordinary hosted sign-in still requires qualification');
}catch{
 // Fixed phase names only. Never retain passwords, hashes, raw provider/SQL errors.
 console.error('STAGING_OWNER_CREDENTIALS_BLOCKED: '+phase+'; no automatic rotation, replay or repair. Read-only inspection required after any uncertain commit.');process.exitCode=1;
}finally{if(db)await db.end().catch(()=>{});}
