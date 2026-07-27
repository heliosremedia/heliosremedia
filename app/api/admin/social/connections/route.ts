import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceId } from "@/lib/workspaces";

const clean=(value:unknown,max=100)=>typeof value==="string"?value.trim().slice(0,max):"";
export async function PATCH(request:Request){
  const session=await getAdminSession();
  if(!session||!["OWNER","ADMIN"].includes(session.role)) return NextResponse.json({success:false,error:"Unauthorized"},{status:401});
  const body=await request.json() as Record<string,unknown>;const connectionId=clean(body.connectionId);const action=clean(body.action);
  const workspaceId=await requireWorkspaceId(session.userId);
  const connection=await prisma.socialConnection.findFirst({where:{id:connectionId,workspaceId}});
  if(!connection) return NextResponse.json({success:false,error:"Connection not found."},{status:404});
  if(action==="enable"){
    if(!["CONNECTED","CONNECTED_DIRECT_PUBLISHING_DISABLED"].includes(connection.state)||!connection.encryptedTokenPayload||!connection.providerAccountId) return NextResponse.json({success:false,error:"Complete OAuth and select an eligible destination before enabling direct publishing."},{status:409});
    await prisma.$transaction([
      prisma.socialConnection.update({where:{id:connection.id},data:{state:"CONNECTED",directPublishingEnabled:true,directPublishingEnabledAt:new Date(),directPublishingEnabledById:session.userId}}),
      prisma.socialConnectionAudit.create({data:{connectionId:connection.id,actorId:session.userId,action:"DIRECT_PUBLISHING_ENABLED"}}),
    ]);
    return NextResponse.json({success:true,state:"CONNECTED",directPublishingEnabled:true,message:"Direct publishing enabled for this account. Individual posts still require explicit direct-publishing selection."});
  }
  if(action==="disable"){
    await prisma.$transaction([
      prisma.socialConnection.update({where:{id:connection.id},data:{state:"CONNECTED_DIRECT_PUBLISHING_DISABLED",directPublishingEnabled:false,directPublishingEnabledAt:null,directPublishingEnabledById:null}}),
      prisma.socialPublishingJob.updateMany({where:{connectionId:connection.id,status:{in:["SCHEDULED","READY","DELAYED","RETRY_SCHEDULED"]}},data:{status:"MANUAL_FALLBACK",claimToken:null,lastErrorMessage:"Direct publishing was disabled for this account."}}),
      prisma.socialConnectionAudit.create({data:{connectionId:connection.id,actorId:session.userId,action:"DIRECT_PUBLISHING_DISABLED"}}),
    ]);
    return NextResponse.json({success:true,state:"CONNECTED_DIRECT_PUBLISHING_DISABLED",directPublishingEnabled:false,message:"Direct publishing disabled. Future work remains available manually."});
  }
  if(action==="disconnect"){
    if(["PUBLISHING","PROVIDER_PROCESSING"].some(()=>false)) return NextResponse.json({success:false,error:"Wait for in-progress provider submissions to reconcile before disconnecting."},{status:409});
    await prisma.$transaction([
      prisma.socialConnection.update({where:{id:connection.id},data:{state:"DISCONNECTED",directPublishingEnabled:false,encryptedTokenPayload:null,disconnectedAt:new Date(),directPublishingEnabledAt:null,directPublishingEnabledById:null}}),
      prisma.socialPublishingJob.updateMany({where:{connectionId:connection.id,status:{in:["SCHEDULED","READY","DELAYED","RETRY_SCHEDULED"]}},data:{status:"MANUAL_FALLBACK",claimToken:null,lastErrorMessage:"The provider account was disconnected."}}),
      prisma.socialConnectionAudit.create({data:{connectionId:connection.id,actorId:session.userId,action:"DISCONNECTED"}}),
    ]);
    return NextResponse.json({success:true,state:"DISCONNECTED",directPublishingEnabled:false,message:"Account disconnected and pending posts moved to the manual workflow."});
  }
  return NextResponse.json({success:false,error:"Unsupported connection action."},{status:400});
}
