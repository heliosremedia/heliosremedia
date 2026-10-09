import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';
import { requireOrigin } from './safety.mjs';

export async function qualifyStudioProjectCreate(origin, driver) {
  requireOrigin(origin);
  const db = driver.prisma, cases = [], races = [], createdIds = [];
  const memberships = await db.workspaceMembership.findMany({ orderBy: { id: 'asc' } });
  const workspaces = await db.workspace.findMany({ orderBy: { id: 'asc' } });
  const decode = value => value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const identity = (id, requestId) => `draft_${createHash('sha256').update(JSON.stringify(['studio-draft-v1', id, `u${id}`, requestId])).digest('hex')}`;
  async function prepare(id) {
    const page = await http(origin, 'a.example.test', '/admin/projects/new', { headers: { cookie: driver.cookie(id) } });
    assert.equal(page.status, 200);
    const form = [...page.text.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(m=>m[1]).find(value=>value.includes('name="requestId"'));
    assert.ok(form, 'Actual server-action form must be present');
    const fields = [];
    for (const match of form.matchAll(/<input\b[^>]*>/g)) {
      const name=match[0].match(/\bname="([^"]*)"/)?.[1], value=match[0].match(/\bvalue="([^"]*)"/)?.[1];
      if(name?.startsWith('$ACTION_')) fields.push([decode(name),decode(value||'')]);
    }
    assert.ok(fields.some(([name])=>name.startsWith('$ACTION_REF_')||name.startsWith('$ACTION_ID_')), 'Use the emitted Next action identity');
    return fields;
  }
  async function send(id, fields, requestId, title='Synthetic draft') {
    const form = new FormData(); for(const [key,value] of fields) form.append(key,value);
    for(const [key,value] of Object.entries({requestId,title,slug:`studio-create-${id}-${requestId}`,shortDescription:'Synthetic creation test',city:'Fort Collins',state:'Colorado',locationLabel:'',projectType:'Listing Media',propertyType:''})) form.set(key,value);
    const host = `${id==='a'?'b':'a'}.example.test`;
    const response=await fetch(`${origin}/admin/projects/new`,{method:'POST',headers:{host,origin:`http://${host}`,cookie:driver.cookie(id)},body:form,redirect:'manual'});
    return {status:response.status,text:await response.text()};
  }
  try {
    for(const id of ['a','b']) {
      const fields=await prepare(id), requestId=randomUUID(), projectId=identity(id,requestId);createdIds.push(projectId);
      const before=await db.project.count();
      const reply=await send(id,fields,requestId,`Synthetic draft ${id}`);assert.equal(reply.status,200,reply.text.slice(0,200));
      const saved=await db.project.findUniqueOrThrow({where:{id:projectId}});assert.equal(saved.workspaceId,id);assert.equal(saved.status,'DRAFT');assert.equal(saved.city,'Fort Collins');assert.equal(saved.title,`Synthetic draft ${id}`);
      assert.ok(reply.text.includes(projectId));assert.equal(await db.project.count(),before+1);
      const replay=await send(id,fields,requestId,'Ignored replay changes');assert.equal(replay.status,200);assert.equal(await db.project.count(),before+1);assert.deepEqual(await db.project.findUniqueOrThrow({where:{id:projectId}}),saved);
      for(const change of ['viewer','revoked','suspended']) {
        const key=randomUUID(), candidate=identity(id,key);createdIds.push(candidate);let pending;
        try {
          await db.$transaction(async tx=>{
            await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
            const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pending=send(id,fields,key).then(value=>({value}),error=>({error}));
            let observed=false;const deadline=Date.now()+8000;
            while(Date.now()<deadline){const blocked=await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))`;if(blocked.length){observed=true;break;}await delay(25);}
            assert.equal(observed,true,change);
            if(change==='suspended')await tx.workspace.update({where:{id},data:{lifecycleState:'SUSPENDED'}});
            else await tx.workspaceMembership.update({where:{workspaceId_userId:{workspaceId:id,userId:`u${id}`}},data:change==='viewer'?{role:'VIEWER'}:{status:'REVOKED'}});
          },{timeout:15000});
          const result=await pending;assert.equal(result.error,undefined);assert.equal(await db.project.findUnique({where:{id:candidate}}),null);assert.equal(await db.project.count(),before+1);
          races.push({tenant:id,change,databaseWaitObserved:true,noDraftCreated:true});
        } finally {
          await pending;const member=memberships.find(row=>row.workspaceId===id);await db.workspaceMembership.update({where:{id:member.id},data:member});const ws=workspaces.find(row=>row.id===id);await db.workspace.update({where:{id},data:{lifecycleState:ws.lifecycleState,updatedAt:ws.updatedAt}});
        }
      }
      cases.push({tenant:id,actualServerAction200:true,ownedDraftCreated:true,replaySameProjectNoMutation:true,forgedHostIgnored:true});
    }
    return {cases,races,actualNextServerAction:true,providerCalls:false,scope:'draft creation only; no publishing'};
  } finally {
    await db.project.deleteMany({where:{id:{in:createdIds}}});
    for(const row of memberships)await db.workspaceMembership.update({where:{id:row.id},data:row});
    for(const row of workspaces)await db.workspace.update({where:{id:row.id},data:{lifecycleState:row.lifecycleState,lifecycleRevision:row.lifecycleRevision,lastReactivatedAt:row.lastReactivatedAt,updatedAt:row.updatedAt}});
    assert.deepEqual(await db.workspaceMembership.findMany({orderBy:{id:'asc'}}),memberships);assert.deepEqual(await db.workspace.findMany({orderBy:{id:'asc'}}),workspaces);
  }
}
