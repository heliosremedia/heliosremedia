import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { tenantContextEnabled } from "@/lib/workspace-context-core";
import { normalizeEmail } from "./normalization";
import { workspaceMarketingEligibility } from "./workspace-consent-policy";
import { marketingStatusAllowsSend } from "./preference-rules";

type Reader = Pick<Prisma.TransactionClient, "workspace" | "workspaceMarketingPreference" | "marketingEmailPreference" | "communicationSuppression">;

/** Server-owned workspace required. Legacy permission is confined to a sole matching workspace with tenant mode off. */
export async function eligibleMarketingAddresses(db: Reader, workspaceId: string, emails: string[]) {
  if (!workspaceId) throw new Error("CONSENT_WORKSPACE_REQUIRED");
  const addresses = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  if (!addresses.length) return new Set<string>();
  let legacyCompatibility = false;
  if (!tenantContextEnabled()) {
    const workspaces = await db.workspace.findMany({ take: 2, select: { id: true } });
    legacyCompatibility = workspaces.length === 1 && workspaces[0].id === workspaceId;
  }
  const [legacy, safety, company] = await Promise.all([
    db.marketingEmailPreference.findMany({ where: { normalizedEmail: { in: addresses } }, select: { normalizedEmail: true, status: true } }),
    db.communicationSuppression.findMany({ where: { normalizedEmail: { in: addresses }, releasedAt: null }, select: { normalizedEmail: true } }),
    db.workspaceMarketingPreference.findMany({ where: { workspaceId, normalizedEmail: { in: addresses } }, select: { normalizedEmail: true, status: true } }),
  ]);
  const legacyByEmail = new Map(legacy.map(row => [row.normalizedEmail, row.status]));
  const companyByEmail = new Map(company.map(row => [row.normalizedEmail, row.status]));
  const blocked = new Set(safety.map(row => row.normalizedEmail));
  return new Set(addresses.filter(email => legacyCompatibility && !companyByEmail.has(email)
    ? !blocked.has(email) && marketingStatusAllowsSend(legacyByEmail.get(email))
    : workspaceMarketingEligibility({ companyStatus: companyByEmail.get(email), legacyStatus: legacyByEmail.get(email), safetySuppressed: blocked.has(email) }).eligible));
}

export async function workspaceAddressIsMarketingEligible(db: Reader, workspaceId: string, email: string) {
  return (await eligibleMarketingAddresses(db, workspaceId, [email])).has(normalizeEmail(email));
}
