import "server-only";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { tenantContextEnabled } from "@/lib/workspace-context-core";
import { eligibleMarketingAddresses } from "./delivery-consent";
import { normalizeEmail } from "./normalization";

type Client = { id: string; normalizedEmail: string; emailSubscribed: boolean };
/** Only pass clients from the authenticated workspace's owned directory query. No global reasons or provenance escape tenant mode. */
export async function readClientConsentProjection(db: Pick<PrismaClient, "$transaction">, workspaceId: string, clients: Client[]) {
  if (!workspaceId) throw new Error("CONSENT_WORKSPACE_REQUIRED");
  return db.$transaction(async tx => {
    const addresses = [...new Set(clients.map(client => normalizeEmail(client.normalizedEmail)).filter(Boolean))];
    let legacyCompatibility = false;
    if (!tenantContextEnabled()) {
      const rows = await tx.workspace.findMany({ take: 2, select: { id: true } });
      legacyCompatibility = rows.length === 1 && rows[0].id === workspaceId;
    }
    const [eligible, company, legacy, safety] = await Promise.all([
      eligibleMarketingAddresses(tx, workspaceId, addresses),
      tx.workspaceMarketingPreference.findMany({ where: { workspaceId, normalizedEmail: { in: addresses } }, select: { normalizedEmail: true, status: true, source: true, effectiveAt: true } }),
      tx.marketingEmailPreference.findMany({ where: { normalizedEmail: { in: addresses } }, select: { normalizedEmail: true, status: true, source: true, effectiveAt: true } }),
      tx.communicationSuppression.findMany({ where: { normalizedEmail: { in: addresses }, releasedAt: null }, select: { normalizedEmail: true } }),
    ]);
    const ownByEmail = new Map(company.map(row => [row.normalizedEmail, row]));
    const legacyByEmail = new Map(legacy.map(row => [row.normalizedEmail, row]));
    const suppressed = new Set(safety.map(row => row.normalizedEmail));
    return clients.map(client => {
      const email = normalizeEmail(client.normalizedEmail), own = ownByEmail.get(email), old = legacyByEmail.get(email);
      const protectedBlock = suppressed.has(email) || ["UNSUBSCRIBED", "SUPPRESSED"].includes(old?.status || "");
      const compatibility = legacyCompatibility && !own;
      const visible = own ?? (compatibility ? old : undefined);
      const redact = !compatibility && (protectedBlock || !client.emailSubscribed);
      return {
        id: client.id,
        companyConsent: !compatibility,
        emailStatus: redact || suppressed.has(email) ? "SUPPRESSED" : visible?.status ?? (client.emailSubscribed ? "UNKNOWN" : "UNSUBSCRIBED"),
        emailStatusEffectiveAt: redact || suppressed.has(email) ? null : visible?.effectiveAt.toISOString() ?? null,
        emailStatusSource: redact || suppressed.has(email) ? null : visible?.source ?? null,
        marketingEligible: client.emailSubscribed && eligible.has(email),
      };
    });
  }, { isolationLevel: "RepeatableRead" });
}
