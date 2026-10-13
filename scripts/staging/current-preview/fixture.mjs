import assert from 'node:assert/strict';
import {OWNER_WORKSPACES,ownerAdmission,ownerPasswords} from '../owner-credentials.mjs';
import {verifyUpgradeSnapshot} from '../current-upgrade-policy.mjs';
export async function fixtureAdmission(state,passwords,auth){
 ownerPasswords(passwords);const normalized=structuredClone(state);
 for(let i=0;i<OWNER_WORKSPACES.length;i++){
  const u=normalized.data.AdminUser.find(r=>r.id===OWNER_WORKSPACES[i]+'-owner');assert.ok(u);
  assert.equal(u.sessionVersion,2);assert.match(u.passwordHash||'',/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.equal(await auth.verifyPassword(passwords[i],u.passwordHash),true,'Stored credential mismatch');
  assert.equal(await auth.verifyPassword(passwords[1-i],u.passwordHash),false,'Foreign owner password accepted');
  u.passwordHash=null;u.sessionVersion=1;
 }
 ownerAdmission(normalized);
}
export function authTransition(before,after,bindings){
 verifyUpgradeSnapshot(after,'current');assert.equal(after.schemaHash,before.schemaHash);assert.deepEqual(after.ledger,before.ledger);
 const expected=structuredClone(before.data),actual=structuredClone(after.data);
 for(const id of OWNER_WORKSPACES){
  const u=actual.AdminUser.find(r=>r.id===id+'-owner'),old=expected.AdminUser.find(r=>r.id===u.id);
  assert.equal(u.failedLoginCount,0);assert.equal(u.lockedUntil,null);assert.ok(Number.isFinite(new Date(u.lastLoginAt).getTime()));
  for(const key of ['failedLoginCount','lockedUntil','lastLoginAt','updatedAt'])u[key]=old[key];
  const domain=actual.WorkspaceDomain.find(r=>r.workspaceId===id);const bound=bindings.find(r=>r.workspaceId===id);assert.ok(bound);assert.equal(domain.hostname,bound.hostname);domain.hostname=id+'.example.test';
 }
 assert.equal(expected.AuditEvent.length,0);
 const audits=actual.AuditEvent;assert.equal(audits.length,10);
 for(const id of OWNER_WORKSPACES){const owned=audits.filter(r=>r.workspaceId===id);assert.equal(owned.length,5);assert.deepEqual(owned.map(r=>r.action).sort(),['AUTH_LOGIN_FAILED','AUTH_LOGIN_SUCCEEDED','AUTH_LOGIN_SUCCEEDED','AUTH_LOGOUT','AUTH_LOGOUT']);for(const row of owned){assert.equal(row.actorId,id+'-owner');assert.equal(row.actorEmail,id+'@example.test');assert.equal(row.entityType,'AdminUser');assert.equal(row.entityId,id+'-owner');}}
 actual.AuditEvent=[];assert.deepEqual(actual,expected,'Unexpected stored mutation in hosted qualification');
}
