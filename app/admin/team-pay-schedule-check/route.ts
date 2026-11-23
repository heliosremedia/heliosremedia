import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { teamPayScheduleCapability } from "@/lib/team-pay-schedule-capability";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=30;

export function GET(request:Request){
 return teamPayScheduleCapability(request,{readActor:async()=>{
  const session=await getAdminSession();
  if(!session)return null;
  const actor=await prisma.adminUser.findFirst({
   where:{id:session.userId,workspaceId:session.workspaceId,active:true,state:"ACTIVE",
    sessionVersion:session.sessionVersion},
   select:{id:true,role:true,workspaceId:true},
  });
  return actor??{id:session.userId,role:"DENY",workspaceId:session.workspaceId};
 }});
}
