import { prisma } from "@/lib/prisma";

export type ManagedLegalDocument = {
  id: string;
  type: "PRIVACY_POLICY" | "TERMS_OF_SERVICE";
  title: string;
  content: string;
  published: boolean;
  updatedAt: Date;
};

const defaults: ManagedLegalDocument[] = [
  { id: "legal-privacy-policy", type: "PRIVACY_POLICY", title: "Privacy Policy", content: "", published: false, updatedAt: new Date(0) },
  { id: "legal-terms-of-service", type: "TERMS_OF_SERVICE", title: "Terms of Service", content: "", published: false, updatedAt: new Date(0) },
];

export async function getLegalDocuments() {
  try {
    const documents = await prisma.legalDocument.findMany({ orderBy: { type: "asc" } });
    return defaults.map((fallback) => documents.find(({ type }) => type === fallback.type) ?? fallback);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("Using unpublished legal-document defaults because the database is unavailable.", error);
    return defaults;
  }
}

export async function getPublishedLegalDocument(type: ManagedLegalDocument["type"]) {
  try {
    return await prisma.legalDocument.findFirst({ where: { type, published: true } });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("Unable to load the published legal document.", error);
    return null;
  }
}
