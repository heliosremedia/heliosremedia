import type { Metadata } from "next";
import { notFound } from "next/navigation";

import LegalDocumentPage from "@/app/components/LegalDocumentPage";
import { getPublishedLegalDocument } from "@/lib/legal-documents";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const document = await getPublishedLegalDocument("PRIVACY_POLICY");
  return { title: document?.title || "Privacy Policy", robots: document ? undefined : { index: false, follow: false } };
}

export default async function PrivacyPage() {
  const document = await getPublishedLegalDocument("PRIVACY_POLICY");
  if (!document) notFound();
  return <LegalDocumentPage document={document} />;
}
