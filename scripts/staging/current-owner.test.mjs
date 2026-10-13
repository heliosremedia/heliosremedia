import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ownerPasswords,ownerAdmission,ownerTransition,OWNER_WORKSPACES} from './owner-credentials.mjs';
import {ownerInvocation} from './owner-invocation.mjs';
import {ownerAuth} from './owner-auth.mjs';
import {UPGRADE_SCHEMA} from './current-upgrade-policy.mjs';
const history=JSON.parse(readFileSync(new URL('../migrations/bootstrap/history-sha256.json',import.meta.url)));
const extensions=JSON.parse(readFileSync(new URL('../rehearsal/staging-upgrade/migrations.json',import.meta.url)));
function fixture(){
 const data={Workspace:[],AdminUser:[],WorkspaceMembership:[],SiteSettings:[],Project:[],HomepageProject:[],WorkspaceDomain:[],AuditEvent:[]};
 for(const id of OWNER_WORKSPACES){
  data.Workspace.push({id,slug:id,lifecycleState:'ACTIVE',lifecycleRevision:0});
  data.AdminUser.push({id:id+'-owner',workspaceId:id,email:id+'@example.test',role:'OWNER',active:true,passwordHash:null,sessionVersion:1,failedLoginCount:0,lockedUntil:null,lastLoginAt:null});
  data.WorkspaceMembership.push({workspaceId:id,userId:id+'-owner',role:'OWNER',status:'ACTIVE'});
  data.SiteSettings.push({id:id+'-settings',workspaceId:id});data.Project.push({id:id+'-project',workspaceId:id});
  data.HomepageProject.push({id:id+'-placement',projectId:id+'-project'});data.WorkspaceDomain.push({workspaceId:id,hostname:id+'.example.test',purpose:'PUBLIC_SITE',status:'ACTIVE'});
 }
 const ledger=Object.entries({'20260909000000_verified_pre_v2_baseline':'6eb3e3af3536ec58df86fcdf5739c2b07dc1664263410c06ceed012c6c6e3dbb',...Object.fromEntries(Object.entries(history).filter(([name])=>name.startsWith('2026091'))),...extensions}).map(([migration_name,checksum],i)=>({id:'migration-'+i,migration_name,checksum,started_at:'2026-10-10T10:00:00Z',finished_at:'2026-10-10T10:01:00Z',rolled_back_at:null,applied_steps_count:1}));
 return {data,ledger,schemaHash:UPGRADE_SCHEMA.current};
}
test('admits only the exact existing two-owner current fixture',()=>ownerAdmission(fixture()));
for(const [name,change] of [
 ['schema drift',s=>s.schemaHash='0'.repeat(64)],['ledger drift',s=>s.ledger[0].checksum='0'.repeat(64)],
 ['unexpected data',s=>s.data.AuditEvent.push({id:'foreign'})],['missing fixture',s=>delete s.data.SiteSettings],
 ['foreign owner',s=>s.data.AdminUser[0].workspaceId='foreign'],['inactive owner',s=>s.data.AdminUser[0].active=false],
 ['foreign email',s=>s.data.AdminUser[0].email='real@example.com'],['viewer role',s=>s.data.AdminUser[0].role='VIEWER'],
 ['existing credential',s=>s.data.AdminUser[0].passwordHash='existing'],['old sessions changed',s=>s.data.AdminUser[0].sessionVersion=2],
 ['locked account',s=>s.data.AdminUser[0].lockedUntil='2026-10-13'],['prior login',s=>s.data.AdminUser[0].lastLoginAt='2026-10-13'],
 ['suspended membership',s=>s.data.WorkspaceMembership[0].status='SUSPENDED'],['wrong membership role',s=>s.data.WorkspaceMembership[0].role='ADMIN'],
 ['disabled workspace',s=>s.data.Workspace[0].lifecycleState='SUSPENDED'],['changed lifecycle',s=>s.data.Workspace[0].lifecycleRevision=1],
 ['foreign project',s=>s.data.Project[0].workspaceId='packet16-b'],['foreign placement',s=>s.data.HomepageProject[0].projectId='packet16-b-project'],
 ['bound hostname',s=>s.data.WorkspaceDomain[0].hostname='other.example.test']
])test('blocks '+name+' before credentials are initialized',()=>{const s=fixture();change(s);assert.throws(()=>ownerAdmission(s));});
const hashes=['scrypt:'+'a'.repeat(32)+':'+'b'.repeat(128),'scrypt:'+'c'.repeat(32)+':'+'d'.repeat(128)];
test('permits exactly password initialization and session invalidation',()=>{const before=fixture(),after=structuredClone(before);after.data.AdminUser.forEach((u,i)=>{u.passwordHash=hashes[i];u.sessionVersion=2;});ownerTransition(before,after,hashes);after.data.Project[0].title='changed';assert.throws(()=>ownerTransition(before,after,hashes));});
for(const values of [[],['short','short'],['a'.repeat(24),'a'.repeat(24)],['a'.repeat(24),undefined],['a'.repeat(24),' b'.repeat(12)],['a'.repeat(24),'b'.repeat(257)],['a'.repeat(24),'b'.repeat(24)+'\n']])test('rejects invalid password inputs '+JSON.stringify(values?.map(v=>typeof v==='string'?v.length:null)),()=>assert.throws(()=>ownerPasswords(values)));
test('uses the actual application password verifier, with separate salts and foreign-password rejection',async()=>{const auth=await ownerAuth(),a='synthetic-owner-a-password-only',b='synthetic-owner-b-password-only';const hash=await auth.hashPassword(a);assert.equal(await auth.verifyPassword(a,hash),true);assert.equal(await auth.verifyPassword(b,hash),false);assert.notEqual(await auth.hashPassword(a),hash);});
const sha='a'.repeat(40),source='b'.repeat(40),ref='refs/heads/codex/v2-neon-staging-bootstrap';
const env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'heliosremedia/heliosremedia',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:ref,GITHUB_WORKFLOW_REF:'heliosremedia/heliosremedia/.github/workflows/v2-neon-staging-bootstrap.yml@'+ref,GITHUB_SHA:sha,STAGING_EXECUTOR_SHA:sha,STAGING_CANDIDATE_SHA:source,STAGING_TRACK:'persistent-owner-credentials',STAGING_CONFIRMATION:'calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging',STAGING_OWNER_CONFIRMATION:'initialize-two-synthetic-owner-passwords-only',STAGING_REGRESSION_RUN:'123',STAGING_OWNER_REHEARSAL_RUN:'456'};
test('admits exact protected owner invocation',()=>assert.equal(ownerInvocation(env,source),source));
for(const key of Object.keys(env))test('rejects owner invocation mismatch '+key,()=>assert.throws(()=>ownerInvocation({...env,[key]:'invalid'},source)));
for(const key of ['VERCEL','VERCEL_ENV','HELIOS_RELEASE_TARGET'])test('rejects production context '+key,()=>assert.throws(()=>ownerInvocation({...env,[key]:'production'},source)));
test('rejects a different source checkout',()=>assert.throws(()=>ownerInvocation(env,sha)));
