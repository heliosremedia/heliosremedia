import { createHash, createHmac } from "node:crypto";

export function validWorkspacePreferenceToken(token: string) {
  return /^v2\.[A-Za-z0-9_-]{43}$/.test(token);
}
export function workspacePreferenceTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function campaignWorkspacePreferenceToken(input: { workspaceId: string; campaignId: string; recipientId: string; normalizedEmail: string; signingSecret: string }) {
  if (!input.signingSecret || input.signingSecret.trim().length < 32) throw new Error("CONSENT_TOKEN_CONFIGURATION_REQUIRED");
  const value = createHmac("sha256", input.signingSecret).update(JSON.stringify([
    "helios:workspace-marketing-unsubscribe:v2", input.workspaceId, input.campaignId, input.recipientId, input.normalizedEmail,
  ])).digest("base64url");
  return `v2.${value}`;
}
