import "server-only";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { getPublicWorkspaceId } from "@/lib/public-workspace";
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
const documentFields = { id: true, type: true, title: true, content: true, published: true, updatedAt: true } as const;

export async function getLegalDocuments(workspaceId: string) {
  try {
    const documents = await prisma.legalDocument.findMany({ where: await getContentOwnershipScope(workspaceId), orderBy: { type: "asc" }, select: documentFields });
    return defaults.map((fallback) => documents.find(({ type }) => type === fallback.type) ?? fallback);
  } catch {
    if (process.env.NODE_ENV !== "production") console.warn("Using unpublished legal-document defaults", { category: "read_failed" });
    return defaults;
  }
}

export async function getPublishedLegalDocument(type: ManagedLegalDocument["type"]) {
  try {
    return await prisma.legalDocument.findFirst({ where: { type, AND: [await getContentOwnershipScope(await getPublicWorkspaceId())], published: true }, select: documentFields });
  } catch {
    if (process.env.NODE_ENV !== "production") console.warn("Unable to load the published legal document", { category: "read_failed" });
    return null;
  }
}
