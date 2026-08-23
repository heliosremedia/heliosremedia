import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { createOAuthState } from "@/lib/social/security";
import { oauthConfiguration, providerPlatform } from "@/lib/social/oauth";
import { requireWorkspaceId } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";
import { hashOAuthState } from "@/lib/social/meta";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const session = await getAdminSession();
  if (!session || !["OWNER","ADMIN"].includes(session.role)) return NextResponse.json({ error:"Unauthorized" },{status:401});
  const { provider } = await params; const platform=providerPlatform(provider);
  if(!platform) return NextResponse.json({error:"Unsupported provider."},{status:404});
  const config=oauthConfiguration(platform);
  if(!config.clientId || !config.clientSecret || !config.redirectUri || !process.env.SOCIAL_TOKEN_ENCRYPTION_KEY) {
    return NextResponse.redirect(new URL("/admin/social-studio/settings?connection=missing-credentials", process.env.SOCIAL_OAUTH_BASE_URL || "http://localhost:3000"));
  }
  if(provider!=="meta" || process.env.SOCIAL_META_CONNECTIONS_ENABLED!=="true") return NextResponse.redirect(new URL("/admin/social-studio/settings?connection=meta-disabled",process.env.SOCIAL_OAUTH_BASE_URL||request.url));
  const state=createOAuthState();
  const workspaceId=await requireWorkspaceId(session.userId);
  await prisma.socialOAuthSession.create({data:{workspaceId,userId:session.userId,provider,stateHash:hashOAuthState(state),safeReturnPath:"/admin/social-studio/settings",expiresAt:new Date(Date.now()+10*60_000)}});
  const url=new URL(config.authorizeUrl);
  url.searchParams.set(platform==="TIKTOK"?"client_key":"client_id",config.clientId);
  url.searchParams.set("redirect_uri",config.redirectUri); url.searchParams.set("response_type","code"); url.searchParams.set("scope",config.scopes.join(platform==="TIKTOK"?",":" "));
  url.searchParams.set("state",state);
  url.searchParams.set("auth_type","rerequest");
  return NextResponse.redirect(url);
}
