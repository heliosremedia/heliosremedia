import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminSession } from "@/lib/auth/session";
import { createOAuthState } from "@/lib/social/security";
import { oauthConfiguration, providerPlatform } from "@/lib/social/oauth";
import { requireWorkspaceId } from "@/lib/workspaces";

export async function GET(_request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const session = await getAdminSession();
  if (!session || !["OWNER","ADMIN"].includes(session.role)) return NextResponse.json({ error:"Unauthorized" },{status:401});
  const { provider } = await params; const platform=providerPlatform(provider);
  if(!platform) return NextResponse.json({error:"Unsupported provider."},{status:404});
  const config=oauthConfiguration(platform);
  if(!config.clientId || !config.clientSecret || !config.redirectUri || !process.env.SOCIAL_TOKEN_ENCRYPTION_KEY) {
    return NextResponse.redirect(new URL("/admin/social-studio/settings?connection=missing-credentials", process.env.SOCIAL_OAUTH_BASE_URL || "http://localhost:3000"));
  }
  const state=createOAuthState();
  const workspaceId=await requireWorkspaceId(session.userId);
  (await cookies()).set(`social_oauth_${provider}`,`${state}.${session.userId}.${workspaceId}`,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:600});
  const url=new URL(config.authorizeUrl);
  url.searchParams.set(platform==="TIKTOK"?"client_key":"client_id",config.clientId);
  url.searchParams.set("redirect_uri",config.redirectUri); url.searchParams.set("response_type","code"); url.searchParams.set("scope",config.scopes.join(platform==="TIKTOK"?",":" "));
  url.searchParams.set("state",state);
  return NextResponse.redirect(url);
}
