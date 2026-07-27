import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const clean = (value: unknown, max=100) => typeof value === "string" ? value.trim().slice(0,max) : "";
export async function PATCH(request:Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER","ADMIN"].includes(session.role)) return NextResponse.json({success:false,error:"Unauthorized"},{status:401});
  const body = await request.json() as Record<string,unknown>; const jobId=clean(body.jobId); const action=clean(body.action);
  const job=await prisma.socialPublishingJob.findUnique({where:{id:jobId}});
  if(!job) return NextResponse.json({success:false,error:"Publishing job not found."},{status:404});
  if(action==="retry" && ["FAILED","RETRY_SCHEDULED","DELAYED"].includes(job.status)) {
    await prisma.socialPublishingJob.update({where:{id:job.id},data:{status:"RETRY_SCHEDULED",nextAttemptAt:new Date(),claimToken:null}});
    return NextResponse.json({success:true,status:"RETRY_SCHEDULED"});
  }
  if(action==="cancel" && ["SCHEDULED","RETRY_SCHEDULED","DELAYED"].includes(job.status)) {
    await prisma.socialPublishingJob.update({where:{id:job.id},data:{status:"CANCELLED",cancelledAt:new Date(),claimToken:null,lastErrorCategory:"CANCELLED",lastErrorMessage:"Cancelled by an administrator."}});
    return NextResponse.json({success:true,status:"CANCELLED"});
  }
  if(action==="manual-fallback" && !["PUBLISHED","PUBLISHING","PROVIDER_PROCESSING"].includes(job.status)) {
    await prisma.socialPublishingJob.update({where:{id:job.id},data:{status:"MANUAL_FALLBACK",claimToken:null,lastErrorMessage:"Moved to the manual publishing workflow by an administrator."}});
    return NextResponse.json({success:true,status:"MANUAL_FALLBACK"});
  }
  return NextResponse.json({success:false,error:"That action is unsafe for the current job state."},{status:409});
}
