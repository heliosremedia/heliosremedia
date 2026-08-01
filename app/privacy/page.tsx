import type { Metadata } from "next";
import { notFound } from "next/navigation";

import LegalDocumentPage from "@/app/components/LegalDocumentPage";
import { getPublishedLegalDocument } from "@/lib/legal-documents";
import { getSiteSettings } from "@/lib/site-settings";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [document, settings] = await Promise.all([getPublishedLegalDocument("PRIVACY_POLICY"), getSiteSettings()]);
  return buildPageMetadata({ title: `${document?.title || "Privacy Policy"} | ${settings.businessName}`, description: `Learn how ${settings.businessName} collects, uses, and protects information.`, path: "/privacy", settings, noIndex: !document });
}

export default async function PrivacyPage() {
  const document = await getPublishedLegalDocument("PRIVACY_POLICY");
  if (!document) notFound();
  return <LegalDocumentPage document={document} />;
}
