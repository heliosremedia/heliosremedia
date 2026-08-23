import "server-only";
import type { SocialPlatformName } from "./core";
import { META_SCOPES, metaGraphVersion } from "./meta";

export function oauthConfiguration(platform: SocialPlatformName) {
  const baseUrl = process.env.SOCIAL_OAUTH_BASE_URL?.replace(/\/$/, "");
  if (platform === "INSTAGRAM" || platform === "FACEBOOK") return {
    clientId: process.env.META_APP_ID, clientSecret: process.env.META_APP_SECRET,
    authorizeUrl: `https://www.facebook.com/${metaGraphVersion()}/dialog/oauth`, tokenUrl: `https://graph.facebook.com/${metaGraphVersion()}/oauth/access_token`,
    scopes: [...META_SCOPES],
    redirectUri: baseUrl ? `${baseUrl}/api/admin/social/oauth/meta/callback` : "",
  };
  if (platform === "LINKEDIN") return {
    clientId: process.env.LINKEDIN_CLIENT_ID, clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization", tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid","profile","w_organization_social"],
    redirectUri: baseUrl ? `${baseUrl}/api/admin/social/oauth/linkedin/callback` : "",
  };
  return {
    clientId: process.env.TIKTOK_CLIENT_KEY, clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/", tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic","video.upload"],
    redirectUri: baseUrl ? `${baseUrl}/api/admin/social/oauth/tiktok/callback` : "",
  };
}

export function providerPlatform(provider: string): SocialPlatformName | null {
  return provider === "meta" ? "FACEBOOK" : provider === "linkedin" ? "LINKEDIN" : provider === "tiktok" ? "TIKTOK" : null;
}
