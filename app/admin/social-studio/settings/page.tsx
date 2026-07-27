import { prisma } from "@/lib/prisma";
import { ensureSocialSettings } from "@/lib/social/studio";
import SocialSettings from "./SocialSettings";
import { providerConfiguration } from "@/lib/social/providers";

export const dynamic = "force-dynamic";
export default async function SocialSettingsPage() {
  const [settings, connections] = await Promise.all([ensureSocialSettings(), prisma.socialConnection.findMany({ orderBy: { platform: "asc" } })]);
  const guidance = settings.platformGuidance && typeof settings.platformGuidance === "object" && !Array.isArray(settings.platformGuidance) ? settings.platformGuidance as Record<string, string> : {};
  return <SocialSettings initialSettings={{ brandVoice: settings.brandVoice, primaryAudience: settings.primaryAudience, writingGuardrails: settings.writingGuardrails, defaultCallToAction: settings.defaultCallToAction || "", hashtagGuidance: settings.hashtagGuidance || "", prohibitedTopics: settings.prohibitedTopics || "", platformGuidance: guidance }} initialConnections={connections.map((item) => {
    const config=providerConfiguration(item.platform);
    return { id:item.id, platform: item.platform, state: config.configured?item.state:"PROVIDER_CREDENTIALS_MISSING", intendedAccountName: item.intendedAccountName || "", providerUsername:item.providerUsername||"", supportedWorkflow: item.supportedWorkflow, manualPublishingUrl: item.manualPublishingUrl || "", directPublishingEnabled:item.directPublishingEnabled, configured:config.configured, missing:config.missing };
  })}/>;
}
