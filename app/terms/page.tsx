import type { Metadata } from "next";
import { notFound } from "next/navigation";

import LegalDocumentPage from "@/app/components/LegalDocumentPage";
import { getPublishedLegalDocument } from "@/lib/legal-documents";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const document = await getPublishedLegalDocument("TERMS_OF_SERVICE");
  return { title: document?.title || "Terms of Service", robots: document ? undefined : { index: false, follow: false } };
}

export default async function TermsPage() {
  const document = await getPublishedLegalDocument("TERMS_OF_SERVICE");
  if (!document) notFound();
  return <LegalDocumentPage document={document} />;
}
