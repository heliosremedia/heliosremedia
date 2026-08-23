import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { publicDestination, testMetaConnection, type MetaDestination } from "@/lib/social/meta";
import { requireWorkspaceId } from "@/lib/workspaces";

const clean=(value:unknown,max=200)=>typeof value==="string"?value.trim().slice(0,max):"";
async function authorizedSession(id:string,userId:string,workspaceId:string){return prisma.socialOAuthSession.findFirst({where:{id,userId,workspaceId,provider:"meta",consumedAt:null,authorizedAt:{not:null},expiresAt:{gt:new Date()}}});}

export async function GET(request:Request){
  const session=await getAdminSession();if(!session||!["OWNER","ADMIN"].includes(session.role)) return NextResponse.json({success:false,error:"Unauthorized"},{status:401});
  const workspaceId=await requireWorkspaceId(session.userId);const id=clean(new URL(request.url).searchParams.get("session"));const pending=await authorizedSession(id,session.userId,workspaceId);
  if(!pending) return NextResponse.json({success:false,error:"This Meta selection session expired. Connect again."},{status:410});
  const destinations=Array.isArray(pending.discoveredDestinations)?pending.discoveredDestinations as unknown as MetaDestination[]:[];
  return NextResponse.json({success:true,destinations:destinations.map(publicDestination)});
}

export async function POST(request:Request){
  const session=await getAdminSession();if(!session||!["OWNER","ADMIN"].includes(session.role)) return NextResponse.json({success:false,error:"Unauthorized"},{status:401});
  const workspaceId=await requireWorkspaceId(session.userId);const body=await request.json() as Record<string,unknown>;const id=clean(body.sessionId);const selected=Array.isArray(body.destinationKeys)?body.destinationKeys.map(x=>clean(x)).filter(Boolean):[];
  if(!selected.length) return NextResponse.json({success:false,error:"Select at least one Facebook or Instagram destination."},{status:400});
  const pending=await authorizedSession(id,session.userId,workspaceId);if(!pending) return NextResponse.json({success:false,error:"This Meta selection session expired. Connect again."},{status:410});
  const discovered=Array.isArray(pending.discoveredDestinations)?pending.discoveredDestinations as unknown as MetaDestination[]:[];const chosen=discovered.filter(item=>selected.includes(item.key));
  if(chosen.length!==new Set(selected).size) return NextResponse.json({success:false,error:"One or more destinations are invalid."},{status:400});
  try{
    for(const item of chosen) await testMetaConnection({platform:item.platform,providerAccountId:item.providerAccountId,parentProviderAccountId:item.parentProviderAccountId||null,encryptedTokenPayload:item.encryptedPageToken,grantedScopes:item.grantedScopes});
    await prisma.$transaction(async tx=>{
      const consumed=await tx.socialOAuthSession.updateMany({where:{id:pending.id,consumedAt:null,expiresAt:{gt:new Date()}},data:{consumedAt:new Date()}});if(!consumed.count) throw new Error("This Meta selection was already used.");
      for(const item of chosen){
        const connection=await tx.socialConnection.upsert({where:{workspaceId_platform_providerAccountId:{workspaceId,platform:item.platform,providerAccountId:item.providerAccountId}},create:{workspaceId,platform:item.platform,providerAccountId:item.providerAccountId,parentProviderAccountId:item.parentProviderAccountId,intendedAccountName:item.displayName,providerUsername:item.username,profileImageUrl:item.profileImageUrl,state:"CONNECTED_DIRECT_PUBLISHING_DISABLED",encryptedTokenPayload:item.encryptedPageToken,grantedScopes:item.grantedScopes as Prisma.InputJsonValue,directPublishingEnabled:false,tokenExpiresAt:item.tokenExpiresAt?new Date(item.tokenExpiresAt):null,lastAuthorizationCheckAt:new Date(),lastConnectionTestAt:new Date(),lastConnectionTestSuccessAt:new Date(),supportedWorkflow:"Official Meta API publishing after explicit destination selection and enablement"},update:{parentProviderAccountId:item.parentProviderAccountId,intendedAccountName:item.displayName,providerUsername:item.username,profileImageUrl:item.profileImageUrl,state:"CONNECTED_DIRECT_PUBLISHING_DISABLED",encryptedTokenPayload:item.encryptedPageToken,grantedScopes:item.grantedScopes as Prisma.InputJsonValue,directPublishingEnabled:false,tokenExpiresAt:item.tokenExpiresAt?new Date(item.tokenExpiresAt):null,lastAuthorizationCheckAt:new Date(),lastConnectionTestAt:new Date(),lastConnectionTestSuccessAt:new Date(),lastProviderErrorCode:null,lastProviderErrorMessage:null,disconnectedAt:null}});
        await tx.socialConnectionAudit.create({data:{connectionId:connection.id,actorId:session.userId,action:"META_DESTINATION_CONNECTED",sanitizedMetadata:{platform:item.platform,providerAccountId:item.providerAccountId,parentProviderAccountId:item.parentProviderAccountId||null}}});
      }
    });
    return NextResponse.json({success:true,count:chosen.length,message:`Connected ${chosen.length} Meta destination${chosen.length===1?"":"s"}. Direct publishing remains disabled.`});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Meta destinations could not be verified."},{status:409});}
}
