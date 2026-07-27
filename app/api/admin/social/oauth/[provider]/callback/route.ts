import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { encryptSocialToken, verifyOAuthState } from "@/lib/social/security";
import { oauthConfiguration, providerPlatform } from "@/lib/social/oauth";
import { requireWorkspaceId } from "@/lib/workspaces";

export async function GET(request:Request,{params}:{params:Promise<{provider:string}>}) {
  const session=await getAdminSession(); const {provider}=await params; const platform=providerPlatform(provider);
  const settingsUrl=new URL("/admin/social-studio/settings",process.env.SOCIAL_OAUTH_BASE_URL || request.url);
  if(!session || !["OWNER","ADMIN"].includes(session.role) || !platform) return NextResponse.json({error:"Unauthorized"},{status:401});
  const url=new URL(request.url); const state=url.searchParams.get("state")||""; const code=url.searchParams.get("code")||"";
  const cookieStore=await cookies(); const saved=cookieStore.get(`social_oauth_${provider}`)?.value||""; cookieStore.delete(`social_oauth_${provider}`);
  const parts=saved.split("."); const workspaceId=parts.pop()||""; const userId=parts.pop()||""; const expected=parts.join(".");
  const actualWorkspaceId=await requireWorkspaceId(session.userId);
  if(!code || userId!==session.userId || workspaceId!==actualWorkspaceId || !verifyOAuthState(expected,state)) return NextResponse.redirect(new URL("?connection=invalid-state",settingsUrl));
  const config=oauthConfiguration(platform);
  if(!config.clientId || !config.clientSecret || !config.redirectUri) return NextResponse.redirect(new URL("?connection=missing-credentials",settingsUrl));
  const tokenBody=new URLSearchParams({code,redirect_uri:config.redirectUri,grant_type:"authorization_code"});
  if(platform==="TIKTOK"){tokenBody.set("client_key",config.clientId);tokenBody.set("client_secret",config.clientSecret);}
  else {tokenBody.set("client_id",config.clientId);tokenBody.set("client_secret",config.clientSecret);}
  try {
    const response=await fetch(config.tokenUrl,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:tokenBody,cache:"no-store"});
    const token=await response.json() as Record<string,unknown>;
    if(!response.ok || typeof token.access_token!=="string") throw new Error("Provider authorization could not be completed.");
    const providerAccountId=typeof token.open_id==="string"?token.open_id:`pending-${session.userId}`;
    const connection=await prisma.socialConnection.upsert({
      where:{workspaceId_platform_providerAccountId:{workspaceId,platform,providerAccountId}},
      create:{workspaceId,platform,providerAccountId,state:platform==="TIKTOK"?"DRAFT_TRANSFER_ONLY":"CONNECTED_DIRECT_PUBLISHING_DISABLED",encryptedTokenPayload:encryptSocialToken({accessToken:token.access_token,refreshToken:token.refresh_token,tokenType:token.token_type}),grantedScopes:config.scopes,directPublishingEnabled:false,lastAuthorizationCheckAt:new Date(),supportedWorkflow:platform==="TIKTOK"?"Official draft transfer and manual completion":"Official API publishing after account selection and explicit enablement"},
      update:{state:platform==="TIKTOK"?"DRAFT_TRANSFER_ONLY":"CONNECTED_DIRECT_PUBLISHING_DISABLED",encryptedTokenPayload:encryptSocialToken({accessToken:token.access_token,refreshToken:token.refresh_token,tokenType:token.token_type}),grantedScopes:config.scopes,directPublishingEnabled:false,lastAuthorizationCheckAt:new Date(),disconnectedAt:null},
    });
    await prisma.socialConnectionAudit.create({data:{connectionId:connection.id,actorId:session.userId,action:"OAUTH_CONNECTED",sanitizedMetadata:{platform,scopes:config.scopes}}});
    return NextResponse.redirect(new URL("?connection=connected-disabled",settingsUrl));
  } catch(error) {
    console.error("Social OAuth callback failed:",error instanceof Error?error.message:"Unknown provider error");
    return NextResponse.redirect(new URL("?connection=error",settingsUrl));
  }
}
