// Runs only after the existing current-upgrade rehearsal in disposable PostgreSQL.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import pg from 'pg';
import {databaseUrl} from '../migrations/bootstrap/artifact.mjs';
import {ownerAuth} from './owner-auth.mjs';
import {OWNER_WORKSPACES,observeOwnerState,initializeOwners} from './owner-credentials.mjs';
assert.equal(process.env.STUDIO_STAGING_UPGRADE,'isolated-only');assert.equal(process.env.PACKET11_REHEARSAL,'isolated-only');
assert.ok(!process.env.STAGING_DIRECT_URL&&!process.env.STAGING_NEON_API_KEY&&!process.env.VERCEL&&!process.env.HELIOS_RELEASE_TARGET);
const db=new pg.Client({connectionString:databaseUrl('packet11_clean')}),other=new pg.Client({connectionString:databaseUrl('packet11_clean')});
const passwords=['synthetic-owner-a-password-only','synthetic-owner-b-password-only'],auth=await ownerAuth();
try{
 await db.connect();await other.connect();
 // Only the two exact disposable upgrade fixtures are replaced with the already
 // established hosted fixtures. This seeding is never imported by owner-live.
 assert.equal((await db.query('SELECT count(*)::int n FROM "Workspace"')).rows[0].n,2);
 for(const id of ['upgrade-a','upgrade-b']){assert.equal((await db.query('DELETE FROM "Project" WHERE id=$1 AND "workspaceId"=$2',[id+'-project',id])).rowCount,1);assert.equal((await db.query('DELETE FROM "Workspace" WHERE id=$1',[id])).rowCount,1);}
 const stamp='2026-10-13T00:00:00Z';
 for(const id of OWNER_WORKSPACES){
  await db.query('INSERT INTO "Workspace" (id,name,slug,"updatedAt") VALUES ($1,$1,$1,$2)',[id,stamp]);
  await db.query('INSERT INTO "AdminUser" (id,email,"displayName",role,"workspaceId",disciplines,"sessionVersion","updatedAt") VALUES ($1,$2,\'Synthetic owner\',\'OWNER\',$3,\'{}\',1,$4)',[id+'-owner',id+'@example.test',id,stamp]);
  await db.query('INSERT INTO "WorkspaceMembership" (id,"workspaceId","userId",role,status,"updatedAt") VALUES ($1,$2,$3,\'OWNER\',\'ACTIVE\',$4)',[id+'-membership',id,id+'-owner',stamp]);
  await db.query('INSERT INTO "SiteSettings" (id,"workspaceId","updatedAt") VALUES ($1,$2,$3)',[id+'-settings',id,stamp]);
  await db.query('INSERT INTO "Project" (id,"workspaceId",title,slug,status,"updatedAt") VALUES ($1,$2,\'Synthetic project\',$1,\'PUBLISHED\',$3)',[id+'-project',id,stamp]);
  await db.query('INSERT INTO "HomepageProject" (id,"projectId","updatedAt") VALUES ($1,$2,$3)',[id+'-placement',id+'-project',stamp]);
  await db.query('INSERT INTO "WorkspaceDomain" (id,"workspaceId",hostname,purpose,status,"updatedAt") VALUES ($1,$2,$3,\'PUBLIC_SITE\',\'ACTIVE\',$4)',[id+'-domain',id,id+'.example.test',stamp]);
 }
 const before=await observeOwnerState(db);
 await other.query('SELECT pg_advisory_lock(1200318)');
 await assert.rejects(initializeOwners(db,passwords,auth),/Another staging operation/);
 await other.query('SELECT pg_advisory_unlock(1200318)');assert.deepEqual(await observeOwnerState(db),before);
 await db.query('UPDATE "WorkspaceMembership" SET status=\'SUSPENDED\' WHERE id=\'packet16-b-membership\'');
 await assert.rejects(initializeOwners(db,passwords,auth),/Synthetic ownership mismatch/);
 assert.equal((await db.query('SELECT count(*)::int n FROM "AdminUser" WHERE "passwordHash" IS NOT NULL')).rows[0].n,0);
 await db.query('UPDATE "WorkspaceMembership" SET status=\'ACTIVE\' WHERE id=\'packet16-b-membership\'');
 await db.query(`CREATE FUNCTION owner_test_interrupt() RETURNS trigger AS $$ BEGIN IF NEW.id='packet16-b-owner' THEN RAISE EXCEPTION 'synthetic interrupted second owner'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER owner_test_interrupt BEFORE UPDATE ON "AdminUser" FOR EACH ROW EXECUTE FUNCTION owner_test_interrupt();`);
 // Catalog drift rejects before mutation, even with an interrupt trigger present.
 await assert.rejects(initializeOwners(db,passwords,auth),/Catalog differs/);
 await db.query('DROP TRIGGER owner_test_interrupt ON "AdminUser";DROP FUNCTION owner_test_interrupt();');
 // Inject a query transport interruption on owner B without changing the catalog.
 const interrupted={query:async(sql,args)=>{if(sql.startsWith('UPDATE "AdminUser"')&&args[1]==='packet16-b-owner')throw Error('synthetic interrupted second owner');return db.query(sql,args);}};
 await assert.rejects(initializeOwners(interrupted,passwords,auth),/synthetic interrupted second owner/);
 assert.deepEqual(await observeOwnerState(db),before,'Second-owner failure rolls back the first credential too');
 const receipt=await initializeOwners(db,passwords,auth),after=await observeOwnerState(db);
 assert.equal(receipt.persistentCredentials,true);
 await assert.rejects(initializeOwners(db,passwords,auth),/Existing credentials require deliberate review/);
 assert.deepEqual(await observeOwnerState(db),after,'Replay must not rotate or rewrite credentials');
 await db.end();await other.end();
 const reconnected=new pg.Client({connectionString:databaseUrl('packet11_clean')});await reconnected.connect();
 for(let i=0;i<OWNER_WORKSPACES.length;i++){const row=(await reconnected.query('SELECT "passwordHash","sessionVersion" FROM "AdminUser" WHERE id=$1',[OWNER_WORKSPACES[i]+'-owner'])).rows[0];assert.equal(await auth.verifyPassword(passwords[i],row.passwordHash),true);assert.equal(await auth.verifyPassword(passwords[1-i],row.passwordHash),false);assert.equal(row.sessionVersion,2);}
 await reconnected.end();
 const safe={...receipt,candidate:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),target:'disposable-local-postgresql16',result:'passed',gates:{concurrentOperationBlocked:true,inactiveMembershipBlocked:true,schemaDriftBlocked:true,secondOwnerFailureAtomic:true,replayCannotRotate:true,credentialsSurviveReconnect:true,applicationVerifierUsed:true}};
 await mkdir('staging-evidence',{recursive:true});await writeFile('staging-evidence/owner-credentials-isolated.json',JSON.stringify(safe,null,2)+'\n');
 console.log('STAGING_OWNER_CREDENTIAL_REHEARSAL_PASSED');
}finally{await db.end().catch(()=>{});await other.end().catch(()=>{});}
