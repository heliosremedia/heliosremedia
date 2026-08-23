import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { oauthConfiguration, providerPlatform } from "@/lib/social/oauth";
import { requireWorkspaceId } from "@/lib/workspaces";
import { discoverMetaDestinations, exchangeMetaCode, hashOAuthState } from "@/lib/social/meta";

export async function GET(request:Request,{params}:{params:Promise<{provider:string}>}) {
  const session=await getAdminSession(); const {provider}=await params; const platform=providerPlatform(provider);
  const settingsUrl=new URL("/admin/social-studio/settings",process.env.SOCIAL_OAUTH_BASE_URL || request.url);
  if(!session || !["OWNER","ADMIN"].includes(session.role) || !platform) return NextResponse.json({error:"Unauthorized"},{status:401});
  const url=new URL(request.url); const state=url.searchParams.get("state")||""; const code=url.searchParams.get("code")||"";const denied=url.searchParams.get("error");
  const actualWorkspaceId=await requireWorkspaceId(session.userId);
  if(denied) return NextResponse.redirect(new URL("?connection=denied",settingsUrl));
  const oauthSession=state?await prisma.socialOAuthSession.findUnique({where:{stateHash:hashOAuthState(state)}}):null;
  if(!code||!oauthSession||oauthSession.consumedAt||oauthSession.expiresAt<=new Date()||oauthSession.userId!==session.userId||oauthSession.workspaceId!==actualWorkspaceId||oauthSession.provider!==provider) return NextResponse.redirect(new URL("?connection=invalid-state",settingsUrl));
  const config=oauthConfiguration(platform);
  if(!config.clientId || !config.clientSecret || !config.redirectUri) return NextResponse.redirect(new URL("?connection=missing-credentials",settingsUrl));
  try {
    if(provider!=="meta") throw new Error("This release supports Meta connections only.");
    const token=await exchangeMetaCode({code,redirectUri:config.redirectUri});
    const destinations=await discoverMetaDestinations(token.accessToken,token.tokenExpiresAt);
    await prisma.socialOAuthSession.update({where:{id:oauthSession.id},data:{authorizedAt:new Date(),discoveredDestinations:destinations as unknown as import("@/app/generated/prisma/client").Prisma.InputJsonValue,expiresAt:new Date(Date.now()+10*60_000)}});
    const next=new URL(settingsUrl);next.searchParams.set("metaSession",oauthSession.id);next.searchParams.set("connection",destinations.length?"choose-destinations":"no-destinations");return NextResponse.redirect(next);
  } catch(error) {
    await prisma.socialOAuthSession.updateMany({where:{id:oauthSession.id,consumedAt:null},data:{consumedAt:new Date()}});
    console.error("Social OAuth callback failed:",error instanceof Error?error.name:"Unknown provider error");
    return NextResponse.redirect(new URL("?connection=error",settingsUrl));
  }
}
