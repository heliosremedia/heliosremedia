// Runner-side only. No HTTP endpoint, password seed or authorization bypass.
import assert from 'node:assert/strict';
import { createSessionToken, verifySessionToken, SESSION_COOKIE } from '../../lib/auth/token.ts';
export function syntheticCookie(input: {
  workspaceId: string; hostname: string; allowedHosts: string[];
  user: {id:string;email:string;displayName:string;workspaceId:string|null;active:boolean;role:string;sessionVersion:number;passwordHash:string|null};
  membership: {workspaceId:string;userId:string;role:string;status:string};
}) {
 const {workspaceId,hostname,user,membership}=input;
 assert.ok(['packet16-a','packet16-b'].includes(workspaceId));
 assert.ok(input.allowedHosts.includes(hostname));assert.match(hostname,/^helios-v2-staging-[a-z0-9-]+\.vercel\.app$/);
 assert.equal(user.id,workspaceId+'-owner');assert.equal(user.workspaceId,workspaceId);
 assert.equal(user.email,workspaceId+'@example.test');assert.equal(user.active,true);assert.equal(user.role,'OWNER');assert.equal(user.passwordHash,null);
 assert.equal(membership.workspaceId,workspaceId);assert.equal(membership.userId,user.id);assert.equal(membership.role,'OWNER');assert.equal(membership.status,'ACTIVE');
 const value=createSessionToken({userId:user.id,email:user.email,displayName:user.displayName,role:'OWNER',sessionVersion:user.sessionVersion});
 assert.equal(verifySessionToken(value)?.userId,user.id);
 return {name:SESSION_COOKIE,value,domain:hostname,path:'/',secure:true,httpOnly:true,sameSite:'Lax' as const};
}
