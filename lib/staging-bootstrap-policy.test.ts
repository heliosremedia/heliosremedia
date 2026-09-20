import {spawnSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {TARGET,REF,ENVIRONMENT,invocation,protection,targetConnection,jsonGet} from '../scripts/staging/policy.mjs';
const env=()=>({GITHUB_REPOSITORY:'heliosremedia/heliosremedia',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:REF,GITHUB_SHA:'a'.repeat(40),STAGING_CANDIDATE_SHA:'a'.repeat(40),STAGING_TRACK:'clean-bootstrap',STAGING_CONFIRMATION:TARGET.project+'/'+TARGET.branch+'/'+TARGET.database});
const metadata=()=>({project:{id:String(TARGET.project),name:'helios-v2-staging',org_id:String(TARGET.organization),region_id:TARGET.region,pg_version:16},branch:{id:String(TARGET.branch),project_id:String(TARGET.project),name:'main',current_state:'ready'},endpoints:[{project_id:String(TARGET.project),branch_id:String(TARGET.branch),type:'read_write',host:'ep-test.us-west-2.aws.neon.tech'}],databases:[{name:TARGET.database,branch_id:String(TARGET.branch)}]});
const url='postgresql://synthetic:synthetic@ep-test.us-west-2.aws.neon.tech/helios_v2_staging?sslmode=require';
test('staging admission accepts only exact manual candidate and target',()=>assert.equal(invocation(env()),'a'.repeat(40)));
for(const [key,value] of Object.entries({GITHUB_REPOSITORY:'foreign/repo',GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',STAGING_CANDIDATE_SHA:'b'.repeat(40),STAGING_TRACK:'historical-ledger',STAGING_CONFIRMATION:'production',VERCEL:'1'}))test('staging rejects '+key,()=>assert.throws(()=>invocation({...env(),[key]:value})));
test('staging direct connection preserves verified TLS',()=>assert.equal(targetConnection(metadata(),url).ssl.rejectUnauthorized,true));
for(const [label,change] of Object.entries({foreignProject:(m: ReturnType<typeof metadata>): unknown=>m.project.id='foreign',foreignBranch:(m: ReturnType<typeof metadata>): unknown=>m.branch.id='foreign',wrongOwner:(m: ReturnType<typeof metadata>): unknown=>m.project.org_id='foreign',wrongVersion:(m: ReturnType<typeof metadata>): unknown=>m.project.pg_version=17,foreignEndpoint:(m: ReturnType<typeof metadata>): unknown=>m.endpoints[0].branch_id='foreign',missingDatabase:(m: ReturnType<typeof metadata>): unknown=>m.databases=[]}))test('staging rejects '+label,()=>{const m=metadata();change(m);assert.throws(()=>targetConnection(m,url));});
for(const [label,value] of Object.entries({pooled:url.replace('ep-test.','ep-test-pooler.'),wrongDB:url.replace('helios_v2_staging','neondb'),unsafeTLS:url.replace('require','disable'),injectedOptions:url+'&options=bad',wrongPort:url.replace('.tech/','.tech:123/')}))test('staging rejects URL '+label,()=>assert.throws(()=>targetConnection(metadata(),value)));
const protectedEnv=()=>({name:ENVIRONMENT,can_admins_bypass:false,protection_rules:[{type:'required_reviewers',reviewers:[{type:'User',reviewer:{login:'heliosremedia'}}]}],deployment_branch_policy:{custom_branch_policies:true}});
const branches=()=>({total_count:1,branch_policies:[{name:REF.slice(11),type:'branch'}]});
test('staging requires protected owner approval and exact branch policy',()=>protection(protectedEnv(),branches()));
test('staging rejects absent reviewer',()=>assert.throws(()=>protection({...protectedEnv(),protection_rules:[]},branches())));
test('staging rejects admin bypass',()=>assert.throws(()=>protection({...protectedEnv(),can_admins_bypass:true},branches())));
test('staging rejects broad branch policy',()=>assert.throws(()=>protection(protectedEnv(),{total_count:1,branch_policies:[{name:'*',type:'branch'}]})));
test('staging metadata requires credentials before network',async()=>{await assert.rejects(jsonGet('https://example.invalid',''));});

test('actual staging executor with no manual authority exits before network or Prisma',()=>{
 const result=spawnSync(process.execPath,['scripts/staging/bootstrap.mjs'],{env:{PATH:process.env.PATH},encoding:'utf8',timeout:10000});
 assert.equal(result.status,1);assert.match(result.stderr,/STAGING_BOOTSTRAP_BLOCKED/);assert.equal(result.stdout,'');
});
