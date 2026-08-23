import { prisma } from "@/lib/prisma";
import { ensureSocialSettings } from "@/lib/social/studio";
import SocialSettings from "./SocialSettings";
import { providerConfiguration } from "@/lib/social/providers";
import { getAdminSession } from "@/lib/auth/session";
import { requireWorkspaceId } from "@/lib/workspaces";
import { redirect } from "next/navigation";
import { oauthConfiguration } from "@/lib/social/oauth";
import { webhookReady } from "@/lib/uptimerobot";
import { visibleSocialConnections } from "@/lib/social/visible-connections";

export const dynamic = "force-dynamic";
export default async function SocialSettingsPage({searchParams}:{searchParams:Promise<{metaSession?:string;connection?:string}>}) {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  const workspaceId = await requireWorkspaceId(session.userId);
  const [settings, connections] = await Promise.all([ensureSocialSettings(workspaceId), prisma.socialConnection.findMany({ where: { workspaceId,platform:{in:["FACEBOOK","INSTAGRAM"]} }, orderBy: { platform: "asc" } })]);
  const displayedConnections = visibleSocialConnections(connections);
  const guidance = settings.platformGuidance && typeof settings.platformGuidance === "object" && !Array.isArray(settings.platformGuidance) ? settings.platformGuidance as Record<string, string> : {};
  const operations = ["OWNER"].includes(session.role) ? ["FACEBOOK"].map((platform) => {
    const config = oauthConfiguration(platform as "FACEBOOK" | "LINKEDIN" | "TIKTOK");
    return { platform: platform === "FACEBOOK" ? "META" : platform, configured: Boolean(config.clientId && config.clientSecret), callbackUrl: config.redirectUri };
  }) : null;
  const query=await searchParams;
  return <SocialSettings metaSessionId={query.metaSession||""} connectionNotice={query.connection||""} operations={operations} tokenEncryptionConfigured={Boolean(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim())} webhookConfigured={webhookReady()} initialSettings={{ brandVoice: settings.brandVoice, primaryAudience: settings.primaryAudience, writingGuardrails: settings.writingGuardrails, defaultCallToAction: settings.defaultCallToAction || "", hashtagGuidance: settings.hashtagGuidance || "", prohibitedTopics: settings.prohibitedTopics || "", platformGuidance: guidance }} initialConnections={displayedConnections.map((item) => {
    const config=providerConfiguration(item.platform);
    return { id:item.id, platform: item.platform, state: config.configured?item.state:"PROVIDER_CREDENTIALS_MISSING", intendedAccountName: item.intendedAccountName || "", providerUsername:item.providerUsername||"", supportedWorkflow: item.supportedWorkflow, manualPublishingUrl: item.manualPublishingUrl || "", directPublishingEnabled:item.directPublishingEnabled, configured:config.configured, missing:config.missing,lastVerifiedAt:item.lastConnectionTestSuccessAt?.toISOString()||"",lastPublishedAt:item.lastSuccessfulPublicationAt?.toISOString()||"",lastError:item.lastProviderErrorMessage||"",providerAccountId:item.providerAccountId||"" };
  })}/>;
}
