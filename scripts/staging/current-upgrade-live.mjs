// Protected non-production schema upgrade only; no deployment or credential setup.
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {TARGET,ENVIRONMENT,protection,targetConnection,jsonGet} from './policy.mjs';
import {prepareArtifact} from '../migrations/bootstrap/artifact.mjs';
import {verifiedCurrentMigrationSource} from './current-upgrade-source.mjs';
import {upgradeInvocation,qualifiedUpgradeRun} from './current-upgrade-invocation.mjs';
import {executeCurrentUpgrade} from './current-upgrade-execute.mjs';

const root=process.cwd();
let db,old;
try{
 const e=process.env;
 const candidate=upgradeInvocation(e,execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
 execFileSync('git',['diff','--quiet','HEAD','--'],{stdio:'ignore'});
 const token=e.STAGING_GITHUB_READ_TOKEN||e.GITHUB_TOKEN;
 const api='https://api.github.com/repos/heliosremedia/heliosremedia';
 protection(await jsonGet(api+'/environments/'+ENVIRONMENT,token),await jsonGet(api+'/environments/'+ENVIRONMENT+'/deployment-branch-policies',token));
 for(const [id,path] of [[e.STAGING_REGRESSION_RUN,'.github/workflows/v2-regression.yml'],[e.STAGING_UPGRADE_RUN,'.github/workflows/v2-current-staging-upgrade.yml']]){
  assert.match(id||'',/^[1-9][0-9]+$/);
  const run=await jsonGet(api+'/actions/runs/'+id,token);
  qualifiedUpgradeRun(run,candidate,path);
 }
 const {extensions}=await verifiedCurrentMigrationSource();
 const scratch=await mkdtemp(join(tmpdir(),'studio-protected-upgrade-'));
 old=join(scratch,'hosted-source');
 execFileSync('git',['worktree','add','--detach',old,'2999055b2b59467fcfef446c33a47212e72d4712'],{stdio:'pipe'});
 await symlink(join(root,'node_modules'),join(old,'node_modules'),'dir');
 let artifact;
 process.chdir(old);
 try{artifact=await prepareArtifact(join(scratch,'artifact'));await artifact.expand();}
 finally{process.chdir(root);}
 assert.equal(artifact.baselineChecksum,'6eb3e3af3536ec58df86fcdf5739c2b07dc1664263410c06ceed012c6c6e3dbb');
 for(const name of Object.keys(extensions).sort()){
  await mkdir(join(artifact.dir,'migrations',name));
  await writeFile(join(artifact.dir,'migrations',name,'migration.sql'),await readFile('prisma/migrations/'+name+'/migration.sql'));
 }
 // Provider GETs and exact TLS target validation precede any database operation.
 const base='https://console.neon.tech/api/v2/projects/'+TARGET.project,neon=e.STAGING_NEON_API_KEY;
 const project=await jsonGet(base,neon),branch=await jsonGet(base+'/branches/'+TARGET.branch,neon);
 const endpoints=await jsonGet(base+'/endpoints',neon),databases=await jsonGet(base+'/branches/'+TARGET.branch+'/databases',neon);
 const connection=targetConnection({project:project.project,branch:branch.branch,endpoints:endpoints.endpoints,databases:databases.databases},e.STAGING_DIRECT_URL);
 db=new pg.Client(connection);await db.connect();
 assert.equal((await db.query('SELECT current_database() name')).rows[0].name,TARGET.database);
 assert.equal(Math.floor(Number((await db.query('SHOW server_version_num')).rows[0].server_version_num)/10000),16);
 async function deploy(){
  const code=await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy','--config',join(artifact.dir,'prisma.config.ts')],{
    env:{PATH:e.PATH,HOME:e.HOME,DIRECT_URL:e.STAGING_DIRECT_URL},stdio:'ignore'});
   const timeout=setTimeout(()=>child.kill('SIGTERM'),300000);
   child.on('error',error=>{clearTimeout(timeout);reject(error);});
   child.on('exit',code=>{clearTimeout(timeout);resolve(code);});
  });
  assert.equal(code,0,'Migration failed; read-only review required, never retry or repair');
 }
 const result=await executeCurrentUpgrade(db,deploy);
 await mkdir('staging-evidence',{recursive:true});
 await writeFile('staging-evidence/current-upgrade-live.json',JSON.stringify({
  version:1,candidate,executor:e.GITHUB_SHA,target:TARGET,observedAt:new Date().toISOString(),
  mode:'schema-upgrade-only',...result
 },null,2)+'\n');
 console.log('STAGING_CURRENT_UPGRADE_PASSED: schema only; owner login and hosted app remain unqualified');
}catch{
 console.error('STAGING_CURRENT_UPGRADE_BLOCKED: stop; inspect exact schema/ledger read-only before any retry. No automatic repair. Raw diagnostics suppressed.');
 process.exitCode=1;
}finally{
 process.chdir(root);
 if(db)await db.end().catch(()=>{});
 if(old)try{execFileSync('git',['worktree','remove',old],{stdio:'pipe'});}catch{}
}
