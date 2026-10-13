import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyStudioProjectOrder(origin, driver) {
  const db=driver.prisma, cases=[], races=[], ids=[];
  const original=await db.project.findMany({orderBy:{id:'asc'}});
  const memberships=await db.workspaceMembership.findMany({orderBy:{id:'asc'}});
  const workspaces=await db.workspace.findMany({orderBy:{id:'asc'}});
  const snapshot=()=>db.project.findMany({orderBy:{id:'asc'}});
  const send=(id,body)=>http(origin,`${id==='a'?'b':'a'}.example.test`,'/api/admin/projects/order',{method:'PATCH',headers:{cookie:driver.cookie(id),'x-workspace-id':id==='a'?'b':'a'},body});
  try {
    for(const id of ['a','b'])for(const n of [1,2]){const key=`studio-order-${id}-${n}`;ids.push(key);await db.project.create({data:{id:key,workspaceId:id,slug:key,title:key,status:'DRAFT'}});}
    for(const id of ['a','b']){
      const other=id==='a'?'b':'a', target=`studio-order-${id}-1`;
      let review=await driver.getProjectOrderReview(id);
      const order=review.projects.map(p=>p.id).reverse();
      const body={projectIds:order,expectedRevision:review.revision};
      const before=await snapshot();
      const page=await http(origin,`${other}.example.test`,'/admin/projects',{headers:{cookie:driver.cookie(id)}});
      assert.equal(page.status,200);assert.ok(page.text.includes(review.revision));assert.ok(page.text.includes(target));assert.ok(!page.text.includes(`studio-order-${other}-1`));
      for(const [payload,status] of [[{projectIds:order},409],[{...body,projectIds:[]},400],[{...body,projectIds:[...order,order[0]]},400],[{...body,projectIds:[123,...order.slice(1)]},400],[{...body,projectIds:[`studio-order-${other}-1`,...order.slice(1)]},409]]){
        assert.equal((await send(id,payload)).status,status);assert.deepEqual(await snapshot(),before);
      }
      for(const change of ['viewer','revoked','suspended','project-owner','project-title']){
        let pending;
        try {
          await db.$transaction(async tx=>{
            if(change==='project-owner')await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${target} FOR UPDATE`;
            else await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
            const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pending=send(id,body).then(value=>({value}),error=>({error}));
            let observed=false;const deadline=Date.now()+8000;
            while(Date.now()<deadline){if((await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))`).length){observed=true;break;}await delay(25);}
            assert.equal(observed,true,change);
            if(change==='project-owner')await tx.project.update({where:{id:target},data:{workspaceId:other}});
            else if(change==='project-title')await tx.project.update({where:{id:target},data:{title:'Changed after order review'}});
            else if(change==='suspended')await tx.workspace.update({where:{id},data:{lifecycleState:'SUSPENDED'}});
            else await tx.workspaceMembership.update({where:{workspaceId_userId:{workspaceId:id,userId:`u${id}`}},data:change==='viewer'?{role:'VIEWER'}:{status:'REVOKED'}});
          },{timeout:15000});
          const changed=await snapshot(), reply=await pending;assert.equal(reply.error,undefined);assert.equal(reply.value.status,change.startsWith('project-')?409:403);assert.deepEqual(await snapshot(),changed);
          races.push({tenant:id,change,databaseWaitObserved:true,noUnreviewedWrite:true});
        } finally {
          await pending;
          for(const row of before)await db.project.update({where:{id:row.id},data:row});
          const member=memberships.find(m=>m.workspaceId===id);await db.workspaceMembership.update({where:{id:member.id},data:member});
          const workspace=workspaces.find(w=>w.id===id);await db.workspace.update({where:{id},data:{lifecycleState:workspace.lifecycleState,updatedAt:workspace.updatedAt}});
        }
      }
      const replies=await Promise.all([send(id,body),send(id,body)]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);
      const receipt=JSON.parse(replies.find(r=>r.status===200).text);review=await driver.getProjectOrderReview(id);
      assert.deepEqual(receipt.projectIds,order);assert.equal(receipt.workspaceId,id);assert.equal(receipt.revision,review.revision);assert.notEqual(receipt.revision,body.expectedRevision);assert.deepEqual(review.projects.map(p=>p.id),order);
      const saved=await snapshot();assert.equal((await send(id,body)).status,409);assert.deepEqual(await snapshot(),saved);
      assert.deepEqual(saved.filter(p=>p.workspaceId===other),before.filter(p=>p.workspaceId===other));
      for(const row of before.filter(p=>p.workspaceId===id)){const after=saved.find(p=>p.id===row.id);assert.deepEqual({...after,displayOrder:row.displayOrder,updatedAt:row.updatedAt},row);assert.ok(after.updatedAt>row.updatedAt);}
      // Preserve the established editor content-writing threshold, while viewers cannot reorder.
      const member=memberships.find(m=>m.workspaceId===id);await db.workspaceMembership.update({where:{id:member.id},data:{role:'EDITOR'}});
      const editor=await send(id,{projectIds:[...order].reverse(),expectedRevision:review.revision});assert.equal(editor.status,200);
      await db.workspaceMembership.update({where:{id:member.id},data:member});
      cases.push({tenant:id,ownedPage:true,invalidForeignMissingRevisionDenied:true,concurrentSingleWinner:true,staleReplayUnchanged:true,orderedScopedReceipt:true,otherWorkspaceUnchanged:true,contentRetained:true,editorAllowed:true});
    }
    return {cases,races,actualNextHttp:true,liveProviderCalls:false};
  } finally {
    await db.project.deleteMany({where:{id:{in:ids}}});
    for(const row of original)await db.project.update({where:{id:row.id},data:row});
    for(const row of memberships)await db.workspaceMembership.update({where:{id:row.id},data:row});
    for(const row of workspaces)await db.workspace.update({where:{id:row.id},data:{lifecycleState:row.lifecycleState,updatedAt:row.updatedAt}});
    assert.deepEqual(await snapshot(),original);assert.deepEqual(await db.workspaceMembership.findMany({orderBy:{id:'asc'}}),memberships);assert.deepEqual(await db.workspace.findMany({orderBy:{id:'asc'}}),workspaces);
  }
}
