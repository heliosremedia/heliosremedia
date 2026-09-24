import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {runInNewContext} from 'node:vm';
import {check,checked,diagnostic,eventsSummary} from '../scripts/staging/actions/diagnostics.mjs';
import {CHECK_CODES} from '../scripts/staging/actions/check-codes.mjs';
import {execute} from '../scripts/staging/actions/executor.mjs';
import {invocation,project,deployment,environmentInventory,HOSTED,CANDIDATE,CONFIRMATION,RELEASE_RUN} from '../scripts/staging/actions/policy.mjs';
import {protection,targetConnection,TARGET} from '../scripts/staging/policy.mjs';
const sentinel='private-password-token-DO-NOT-LOG';
function reason(operation:()=>unknown){try{operation();assert.fail('Expected rejection');}catch(error){return diagnostic('preflight',error).reason;}}
const env={GITHUB_REPOSITORY:'heliosremedia/heliosremedia',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/'+HOSTED.branch,GITHUB_SHA:'a'.repeat(40),STAGING_EXECUTOR_SHA:'a'.repeat(40),STAGING_CANDIDATE_SHA:CANDIDATE,STAGING_HOSTED_CONFIRMATION:CONFIRMATION,STAGING_TRACK:'current-baseline',STAGING_CONFIRMATION:TARGET.project+'/'+TARGET.branch+'/'+TARGET.database};
for(const code of CHECK_CODES)test('distinct safe failure, original throw and no mutation: '+code,async()=>{
 const error=Object.assign(new Error('postgres://owner:'+sentinel+'@example.test/db?token='+sentinel),{stderr:sentinel,actual:sentinel,expected:sentinel,reason:sentinel,body:{token:sentinel}});
 assert.throws(()=>check(code,()=>{throw error;}),e=>e===error);
 const safe=diagnostic('preflight',error);assert.equal(safe.reason,'CHECK_'+code);assert.equal(safe.matched,false);assert.deepEqual(Object.keys(safe).sort(),['detailHash','matched','phase','reason']);
 const calls:string[]=[];let evidence:unknown;
 const forbidden=async()=>{calls.push('MUTATION');throw Error('must not execute');};
 await assert.rejects(execute({preflight:async()=>{throw error;},configure:forbidden,create:forbidden,wait:forbidden,receipt:forbidden,qualify:forbidden,suppress:forbidden,unbind:forbidden,unconfigure:forbidden,postflight:forbidden,diagnostics:forbidden,persist:async(value:unknown)=>{evidence=value;}},env),error=>{assert.equal(diagnostic('executor',error).reason,'CHECK_'+code);assert.ok(!JSON.stringify(diagnostic('executor',error)).includes(sentinel));return true;});
 assert.deepEqual(calls,[]);assert.ok(!JSON.stringify(evidence).includes(sentinel));assert.ok(!JSON.stringify(evidence).includes('postgres://'));assert.equal((evidence as {failures:{reason:string}[]}).failures[0].reason,safe.reason);
});
test('async metadata context preserves nested reason without trusting error properties',async()=>{
 let failure;try{await checked('GITHUB_ENVIRONMENT_READ',async()=>check('SCOPED_CREDENTIAL_PRESENCE',()=>assert.ok(false,sentinel)));}catch(e){failure=e;}
 assert.equal(diagnostic('preflight',failure).reason,'CHECK_GITHUB_ENVIRONMENT_READ__SCOPED_CREDENTIAL_PRESENCE');
 assert.ok(!JSON.stringify(diagnostic(sentinel,{message:sentinel,reason:'CHECK_GITHUB_REPOSITORY',codes:[sentinel],safeDiagnostic:{token:sentinel}})).includes(sentinel));
 assert.ok(!JSON.stringify(eventsSummary([{type:sentinel,text:sentinel}])).includes(sentinel));
 assert.throws(()=>check(sentinel,()=>{}),{message:'UNKNOWN_DIAGNOSTIC_CHECK'});
});
const invocationCases:Record<string,string>={GITHUB_REPOSITORY:'GITHUB_REPOSITORY',GITHUB_EVENT_NAME:'GITHUB_EVENT',GITHUB_REF:'GITHUB_BRANCH',STAGING_CANDIDATE_SHA:'CANDIDATE_SHA',STAGING_EXECUTOR_SHA:'EXECUTOR_SHA',STAGING_HOSTED_CONFIRMATION:'HOSTED_CONFIRMATION',STAGING_TRACK:'MIGRATION_TRACK',STAGING_CONFIRMATION:'DATABASE_CONFIRMATION'};
for(const [key,code]of Object.entries(invocationCases))test('actual invocation mismatch '+code,()=>assert.equal(reason(()=>invocation({...env,[key]:sentinel})),'CHECK_'+code));
test('actual executor SHA format remains rejected',()=>assert.equal(reason(()=>invocation({...env,GITHUB_SHA:'bad',STAGING_EXECUTOR_SHA:'bad'})),'CHECK_EXECUTOR_SHA_FORMAT'));
const proj={id:HOSTED.project,name:'helios-v2-staging',accountId:HOSTED.team,link:{type:'github',repoId:HOSTED.repository,productionBranch:'main'},commandForIgnoringBuildStep:'exit 0',autoExposeSystemEnvs:true};
const domains={domains:[{name:'helios-v2-staging.vercel.app'}]};
const projectCases:[string,Record<string,unknown>][]=[['VERCEL_PROJECT_ID',{id:sentinel}],['VERCEL_TEAM_ID',{accountId:sentinel}],['VERCEL_PROJECT_NAME',{name:sentinel}],['VERCEL_GIT_PROVIDER',{link:{...proj.link,type:sentinel}}],['VERCEL_REPOSITORY_ID',{link:{...proj.link,repoId:sentinel}}],['VERCEL_PRODUCTION_BRANCH',{link:{...proj.link,productionBranch:HOSTED.branch}}],['STAGING_SUPPRESSION',{commandForIgnoringBuildStep:'exit 1'}],['VERCEL_SYSTEM_ENV',{autoExposeSystemEnvs:false}],['VERCEL_ROOT_DIRECTORY',{rootDirectory:sentinel}],['VERCEL_OUTPUT_DIRECTORY',{outputDirectory:sentinel}],['VERCEL_BUILD_COMMAND',{buildCommand:sentinel}],['VERCEL_INSTALL_COMMAND',{installCommand:sentinel}],['VERCEL_CUSTOM_ENVIRONMENT',{previewDeploymentSuffix:sentinel}]];
for(const [code,patch]of projectCases)test('actual project mismatch '+code,()=>assert.equal(reason(()=>project({...proj,...patch},domains)),'CHECK_'+code));
test('actual domains and inventory diagnostics distinguish malformed or foreign data',()=>{
 assert.equal(reason(()=>project(proj,{domains:[{name:sentinel}]})),'CHECK_VERCEL_DOMAIN_SET');assert.equal(reason(()=>project(proj,{...domains,pagination:{next:'next'}})),'CHECK_VERCEL_DOMAIN_PAGINATION');
 assert.equal(reason(()=>environmentInventory(null)),'CHECK_VERCEL_ENV_INVENTORY');assert.equal(reason(()=>environmentInventory([{key:sentinel}])),'CHECK_VERCEL_ENV_KEY');assert.equal(reason(()=>environmentInventory([{key:'DATABASE_URL',gitBranch:sentinel}])),'CHECK_VERCEL_ENV_BRANCH_OVERRIDE');
});
const dep={id:'dpl_test',projectId:HOSTED.project,ownerId:HOSTED.team,target:null,gitSource:{type:'github',repoId:HOSTED.repository,sha:CANDIDATE,ref:HOSTED.branch},url:'helios-v2-staging-test.vercel.app',alias:[],readyState:'READY'};
const deploymentCases:[string,Record<string,unknown>][]=[['DEPLOYMENT_PROJECT_ID',{projectId:sentinel}],['DEPLOYMENT_TEAM_ID',{ownerId:sentinel}],['DEPLOYMENT_TARGET',{target:'production'}],['DEPLOYMENT_CUSTOM_ENVIRONMENT',{customEnvironment:{}}],['DEPLOYMENT_GIT_PROVIDER',{gitSource:{...dep.gitSource,type:sentinel}}],['DEPLOYMENT_REPOSITORY_ID',{gitSource:{...dep.gitSource,repoId:sentinel}}],['DEPLOYMENT_SOURCE_SHA',{gitSource:{...dep.gitSource,sha:sentinel}}],['DEPLOYMENT_SOURCE_REF',{gitSource:{...dep.gitSource,ref:sentinel}}],['DEPLOYMENT_ID_FORMAT',{id:sentinel}],['DEPLOYMENT_ID',{id:'dpl_other'}],['DEPLOYMENT_HOSTNAME',{url:sentinel}],['DEPLOYMENT_STATE',{readyState:sentinel}]];
for(const [code,patch]of deploymentCases)test('actual deployment mismatch '+code,()=>assert.equal(reason(()=>deployment({...dep,...patch},dep.id)),'CHECK_'+code));
const policy={name:'helios-v2-staging-bootstrap',can_admins_bypass:false,protection_rules:[{type:'required_reviewers',reviewers:[{type:'User',reviewer:{login:'heliosremedia'}}]}],deployment_branch_policy:{custom_branch_policies:true}};
const branches={total_count:1,branch_policies:[{name:HOSTED.branch,type:'branch'}]};
const policyCases:[string,Record<string,unknown>,Record<string,unknown>][]=[['ENVIRONMENT_NAME',{name:sentinel},{}],['ENVIRONMENT_ADMIN_BYPASS',{can_admins_bypass:true},{}],['ENVIRONMENT_OWNER_REVIEWER',{protection_rules:[]},{}],['ENVIRONMENT_BRANCH_POLICY',{deployment_branch_policy:{custom_branch_policies:false}},{}],['ENVIRONMENT_BRANCH_COUNT',{}, {total_count:2}],['ENVIRONMENT_BRANCH_LENGTH',{}, {branch_policies:[]}],['ENVIRONMENT_BRANCH_NAME',{}, {branch_policies:[{name:sentinel,type:'branch'}]}],['ENVIRONMENT_BRANCH_TYPE',{}, {branch_policies:[{name:HOSTED.branch,type:'tag'}]}]];
for(const [code,p,b]of policyCases)test('actual protected policy mismatch '+code,()=>assert.equal(reason(()=>protection({...policy,...p},{...branches,...b})),'CHECK_'+code));
const neon={project:{id:TARGET.project,name:'helios-v2-staging',org_id:TARGET.organization,region_id:TARGET.region,pg_version:16},branch:{id:TARGET.branch,project_id:TARGET.project,name:'main',current_state:'ready'},databases:[{name:TARGET.database,branch_id:TARGET.branch}],endpoints:[{project_id:TARGET.project,branch_id:TARGET.branch,type:'read_write',host:'staging.example.test'}]};
const url='postgresql://owner:synthetic@staging.example.test/'+TARGET.database+'?sslmode=require';
const neonCases:[string,Record<string,unknown>][]=[['NEON_PROJECT_ID',{project:{...neon.project,id:sentinel}}],['NEON_PROJECT_NAME',{project:{...neon.project,name:sentinel}}],['NEON_ORGANIZATION',{project:{...neon.project,org_id:sentinel}}],['NEON_REGION',{project:{...neon.project,region_id:sentinel}}],['NEON_POSTGRES_VERSION',{project:{...neon.project,pg_version:15}}],['NEON_BRANCH_ID',{branch:{...neon.branch,id:sentinel}}],['NEON_BRANCH_PROJECT',{branch:{...neon.branch,project_id:sentinel}}],['NEON_BRANCH_NAME',{branch:{...neon.branch,name:sentinel}}],['NEON_BRANCH_STATE',{branch:{...neon.branch,current_state:'suspended'}}],['NEON_DATABASE_IDENTITY',{databases:[]}],['DATABASE_ENDPOINT_OWNERSHIP',{endpoints:[]}]];
for(const [code,patch]of neonCases)test('actual Neon identity mismatch '+code,()=>assert.equal(reason(()=>targetConnection({...neon,...patch},url)),'CHECK_'+code));
const urlCases:[string,string][]=[['DATABASE_URL_PARSE',sentinel],['DATABASE_PROTOCOL',url.replace('postgresql:','http:')],['DATABASE_NAME',url.replace(TARGET.database,'foreign')],['DATABASE_CREDENTIAL_PRESENCE',url.replace('owner:synthetic@','')],['DATABASE_FRAGMENT',url+'#'+sentinel],['DATABASE_PORT',url.replace('.test/','.test:9999/')],['DATABASE_TLS',url.replace('require','disable')],['DATABASE_QUERY_KEYS',url+'&token='+sentinel],['DATABASE_DIRECT_ENDPOINT',url.replace('staging.','staging-pooler.')]];
for(const [code,value]of urlCases)test('actual connection rejection '+code,()=>assert.equal(reason(()=>targetConnection(neon,value)),'CHECK_'+code));

// Strip diagnostic-only wrappers, then fingerprint the complete original executable AST.
// These hashes are from reviewed executor 51f6ad1, not a newly generated expectation.
function gateFingerprint(source:string){
 const ast=ts.createSourceFile('guard.mjs',source,ts.ScriptTarget.Latest,true);
 const transformed=ts.transform(ast,[ctx=>root=>{
  function visit(node:ts.Node):ts.VisitResult<ts.Node> | undefined{
   if(ts.isImportDeclaration(node)&&node.importClause?.namedBindings&&ts.isNamedImports(node.importClause.namedBindings)){
    const items=node.importClause.namedBindings.elements.filter(e=>!['check','checked','checkDirtyCheckout'].includes(e.name.text));
    if(!items.length&&!node.importClause.name)return undefined;
    return ts.factory.updateImportDeclaration(node,node.modifiers,ts.factory.updateImportClause(node.importClause,node.importClause.isTypeOnly,node.importClause.name,ts.factory.updateNamedImports(node.importClause.namedBindings,items)),node.moduleSpecifier,node.attributes);
   }
   if(ts.isAwaitExpression(node)&&ts.isCallExpression(node.expression)&&node.expression.expression.getText(ast)==='checked'){
    const body=(node.expression.arguments[1] as ts.ArrowFunction).body;
    if(ts.isCallExpression(body)&&(body.expression.getText(ast).startsWith('assert.')||body.expression.getText(ast)==='hash'))return ts.visitNode(body,visit);
   }
   if(ts.isCallExpression(node)&&node.expression.getText(ast)==='checkDirtyCheckout')return ts.visitNode((node.arguments[0] as ts.ArrowFunction).body,visit);
   if(ts.isCallExpression(node)&&['check','checked'].includes(node.expression.getText(ast)))return ts.visitNode((node.arguments[1] as ts.ArrowFunction).body,visit);
   return ts.visitEachChild(node,visit,ctx);
  }
  return ts.visitNode(root,visit) as ts.SourceFile;
 }]);
 try{return createHash('sha256').update(ts.createPrinter({removeComments:true}).printFile(transformed.transformed[0])).digest('hex');}finally{transformed.dispose();}
}
for(const [path,hash]of Object.entries({
 'scripts/staging/actions/policy.mjs':'c62c54edfba46f21397d9efbe832516835642a321dae5c586f8ccdcb10e2ade7',
 'scripts/staging/policy.mjs':'ffeb3024e47a9323d6015fb407e380f11663d729358a7c7a855d89c3095b50f8',
 'scripts/staging/hosted-build.mjs':'f2534c5b316ccc60c173bdae3440820a264d5f8dc8df6b23792352542e47b57d',
 'scripts/staging/actions/live.mjs':'5eaef8b802fdfeba53e73b16794874302615d6e45a4779779ba535d6a38813b3',
}))test('reviewed checks and effect order remain identical: '+path,()=>assert.equal(gateFingerprint(readFileSync(path,'utf8')),hash));

test('safe labels are unique and every assertion label is registered',()=>{
 assert.equal(new Set(CHECK_CODES).size,CHECK_CODES.length);
 for(const path of ['scripts/staging/actions/policy.mjs','scripts/staging/policy.mjs','scripts/staging/hosted-build.mjs','scripts/staging/actions/live.mjs']){
  for(const match of readFileSync(path,'utf8').matchAll(/(?:check|checked)\('([A-Z_]+)'/g))assert.ok(CHECK_CODES.includes(match[1]),match[1]);
 }
});

// Execute the unchanged live preflight callback with isolated read-only metadata adapters.
// No import of live.mjs, environment credentials, real network, database or dispatch.
for(const [key,code]of Object.entries({head_sha:'GITHUB_RUN_SHA',head_branch:'GITHUB_RUN_BRANCH',status:'GITHUB_RUN_STATUS',conclusion:'GITHUB_RUN_CONCLUSION',path:'GITHUB_RUN_WORKFLOW'}))test('real live preflight rejects run '+key+' before provider mutation',async()=>{
 const source=readFileSync('scripts/staging/actions/live.mjs','utf8');const ast=ts.createSourceFile('live.mjs',source,ts.ScriptTarget.Latest,true);
 let body='';function find(node:ts.Node){if(ts.isPropertyAssignment(node)&&node.name.getText(ast)==='preflight'&&ts.isArrowFunction(node.initializer))body=node.initializer.body.getText(ast);ts.forEachChild(node,find);}find(ast);assert.ok(body);
 const calls:string[]=[];
 const context={env:{STAGING_GITHUB_READ_TOKEN:'synthetic'},ENVIRONMENT:policy.name,HOSTED,CANDIDATE,RELEASE_RUN,assert,check,checked,protection,
  jsonGet:async(url:string)=>{calls.push(url);if(url.endsWith('/deployment-branch-policies'))return branches;if(url.includes('/environments/'))return policy;return {head_sha:CANDIDATE,head_branch:HOSTED.branch,status:'completed',conclusion:'success',path:'.github/workflows/v2-regression.yml',[key]:sentinel};},
  api:async()=>{throw Error('Provider must not be reached');}
 };
 const preflight=runInNewContext('(async()=>'+body+')',context);
 await assert.rejects(preflight(),error=>{assert.equal(diagnostic('preflight',error).reason,'CHECK_'+code);return true;});assert.equal(calls.length,3);
});
test('actual database identity checks retain read-only transaction and rollback',async()=>{
 const {databaseState}=await import('../scripts/staging/hosted-build.mjs');
 for(const [name,version,code]of [['foreign',160015,'DATABASE_CONNECTED_NAME'],[TARGET.database,150000,'DATABASE_CONNECTED_VERSION']] as const){
  const calls:string[]=[];const db={query:async(sql:string)=>{calls.push(sql);return {rows:[{name,server_version_num:version}]};}};
  await assert.rejects(databaseState(db,{}),error=>{assert.equal(diagnostic('preflight',error).reason,'CHECK_'+code);return true;});
  assert.equal(calls[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(calls.at(-1),'ROLLBACK');assert.ok(!calls.includes('COMMIT'));
 }
});
