import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/session';
import { normalizeHomepageCurationPreferences, validHomepageLayout } from '@/lib/homepage-curation-layout';
import { homepageLayoutRevision } from '@/lib/homepage-layout-revision';
import { tenantContextEnabled } from '@/lib/workspace-context-core';
import { resolveMembershipAccess } from '@/lib/workspace-membership-core';
import { prisma } from '@/lib/prisma';

class LayoutConflict extends Error {}
export async function PATCH(request: Request) {
 const session = await getAdminSession();
 if (!session) return NextResponse.json({success:false,error:'Authentication required.'},{status:401});
 const revision=request.headers.get('x-layout-revision'), requestId=request.headers.get('x-layout-request'), workspaceId=request.headers.get('x-layout-workspace');
 if (!revision || !requestId || requestId.length>100 || !workspaceId) return NextResponse.json({success:false,error:'Reload to update the private layout editor.'},{status:409});
 if(workspaceId!==session.workspaceId)return NextResponse.json({success:false,error:'Workspace changed. Retain your layout and reload.'},{status:409});
 let preferences: unknown;
 try { preferences=await request.json(); } catch { return NextResponse.json({success:false,error:'Invalid layout.'},{status:400}); }
 if(!validHomepageLayout(preferences))return NextResponse.json({success:false,error:'A complete valid section layout is required.'},{status:400});
 const submitted={order:[...preferences.order],collapsed:[...preferences.collapsed]};
 try {
  return await prisma.$transaction(async tx=>{
   // Match membership/account mutation lock order, without raising private preference role requirements.
   await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${session.workspaceId} FOR UPDATE`;
   await tx.$queryRaw`SELECT id FROM "AdminUser" WHERE id = ${session.userId} AND "workspaceId" = ${session.workspaceId} FOR UPDATE`;
   const enabled=tenantContextEnabled();
   if(enabled)await tx.$queryRaw`SELECT id FROM "WorkspaceMembership" WHERE "userId" = ${session.userId} AND "workspaceId" = ${session.workspaceId} FOR UPDATE`;
   const user=await tx.adminUser.findFirst({where:{id:session.userId,workspaceId:session.workspaceId}});
   if(!user || user.sessionVersion!==session.sessionVersion || !(await resolveMembershipAccess(user,enabled,(userId,workspaceId)=>tx.workspaceMembership.findUnique({where:{workspaceId_userId:{workspaceId,userId}}})))) throw new LayoutConflict('Current access changed. Retain your layout and reload.');
   const before=homepageLayoutRevision(user.id,user.workspaceId,user.homepageCurationPreferences);
   if(before!==revision)throw new LayoutConflict('Private layout changed. Retain your layout and reload.');
   const stored={...submitted,layoutGeneration:randomUUID()};
   const changed=await tx.adminUser.updateMany({where:{id:user.id,workspaceId:session.workspaceId,sessionVersion:session.sessionVersion,active:true},data:{homepageCurationPreferences:stored}});
   if(changed.count!==1)throw new LayoutConflict('Workspace changed. Retain your layout and reload.');
   const after=await tx.adminUser.findFirst({where:{id:user.id,workspaceId:session.workspaceId}});
   if(!after || JSON.stringify(normalizeHomepageCurationPreferences(after.homepageCurationPreferences))!==JSON.stringify(submitted) || (after.homepageCurationPreferences as {layoutGeneration?:string} | null)?.layoutGeneration!==stored.layoutGeneration)throw new LayoutConflict('Layout readback could not be confirmed.');
   return NextResponse.json({success:true,preferences:normalizeHomepageCurationPreferences(after.homepageCurationPreferences),acknowledgement:{protocol:1,scope:'private-homepage-layout',intent:'replace',requestId,userId:after.id,workspaceId:after.workspaceId,previousRevision:before,revision:homepageLayoutRevision(after.id,after.workspaceId,after.homepageCurationPreferences)}});
  });
 }catch(error){if(error instanceof LayoutConflict)return NextResponse.json({success:false,error:error.message},{status:409});return NextResponse.json({success:false,error:'Layout outcome could not be confirmed.'},{status:500});}
}
