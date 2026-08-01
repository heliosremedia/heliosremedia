import type { Metadata } from "next";
import { notFound } from "next/navigation";

import LegalDocumentPage from "@/app/components/LegalDocumentPage";
import { getPublishedLegalDocument } from "@/lib/legal-documents";
import { getSiteSettings } from "@/lib/site-settings";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [document, settings] = await Promise.all([getPublishedLegalDocument("TERMS_OF_SERVICE"), getSiteSettings()]);
  return buildPageMetadata({ title: `${document?.title || "Terms of Service"} | ${settings.businessName}`, description: `Review the terms that govern services and use of the ${settings.businessName} website.`, path: "/terms", settings, noIndex: !document });
}

export default async function TermsPage() {
  const document = await getPublishedLegalDocument("TERMS_OF_SERVICE");
  if (!document) notFound();
  return <LegalDocumentPage document={document} />;
}
