import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { MetaApiError, testMetaConnection } from "@/lib/social/meta";
import { requireWorkspaceId } from "@/lib/workspaces";

export async function POST(request:Request){
  const session=await getAdminSession();if(!session||!["OWNER","ADMIN"].includes(session.role)) return NextResponse.json({success:false,error:"Unauthorized"},{status:401});
  const workspaceId=await requireWorkspaceId(session.userId);const body=await request.json() as {connectionId?:string};const connection=await prisma.socialConnection.findFirst({where:{id:body.connectionId||"",workspaceId,platform:{in:["FACEBOOK","INSTAGRAM"]}}});
  if(!connection) return NextResponse.json({success:false,error:"Connection not found."},{status:404});
  const checkedAt=new Date();
  try{const result=await testMetaConnection(connection);await prisma.$transaction([prisma.socialConnection.update({where:{id:connection.id},data:{state:connection.directPublishingEnabled?"CONNECTED":"CONNECTED_DIRECT_PUBLISHING_DISABLED",lastAuthorizationCheckAt:checkedAt,lastConnectionTestAt:checkedAt,lastConnectionTestSuccessAt:checkedAt,lastProviderErrorCode:null,lastProviderErrorMessage:null}}),prisma.socialConnectionAudit.create({data:{connectionId:connection.id,actorId:session.userId,action:"CONNECTION_TEST_SUCCEEDED"}})]);return NextResponse.json({success:true,checkedAt:checkedAt.toISOString(),message:`${result.displayName} is available for ${connection.platform.toLowerCase()} publishing.`});}
  catch(error){const code=error instanceof MetaApiError?error.code:"CONNECTION_TEST_FAILED";const message=error instanceof Error?error.message:"Meta could not verify this destination.";const state=["190","TOKEN_MISSING","DESTINATION_MISSING"].includes(code)?"REAUTHORIZATION_REQUIRED":code==="PERMISSION_MISSING"?"PERMISSION_MISSING":"ERROR";await prisma.$transaction([prisma.socialConnection.update({where:{id:connection.id},data:{state,directPublishingEnabled:false,lastConnectionTestAt:checkedAt,lastProviderErrorCode:code,lastProviderErrorMessage:message}}),prisma.socialConnectionAudit.create({data:{connectionId:connection.id,actorId:session.userId,action:"CONNECTION_TEST_FAILED",sanitizedMetadata:{code}}})]);return NextResponse.json({success:false,error:message,state},{status:409});}
}
