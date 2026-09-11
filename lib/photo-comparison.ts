import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicWorkspaceId } from "@/lib/public-workspace";
import { tenantContextEnabled } from "@/lib/workspace-context-core";
import { photoComparisonImageMatchesWorkspace } from "@/lib/photo-comparison-storage";

export type PhotoComparisonContent = {
  heroEyebrow: string;
  heroHeading: string;
  heroAccent: string;
  heroBody: string;
  comparisonEyebrow: string;
  comparisonHeading: string;
  comparisonBody: string;
  standardTitle: string;
  standardPositioning: string;
  standardDescription: string;
  standardFeatures: string[];
  editorialTitle: string;
  editorialPositioning: string;
  editorialDescription: string;
  editorialFeatures: string[];
  editorialBadge: string;
  decisionEyebrow: string;
  decisionHeading: string;
  decisionBody: string;
  ctaEyebrow: string;
  ctaHeading: string;
  ctaBody: string;
  primaryLabel: string;
  primaryDestination: string;
  secondaryLabel: string;
  secondaryDestination: string;
};

export type PhotoComparisonPairValue = {
  id: string;
  label: string;
  editorialStyle: string | null;
  alt: string;
  caption: string;
  active: boolean;
  position: number;
  standardImageStorageKey: string | null;
  standardImageUrl: string;
  editorialImageStorageKey: string | null;
  editorialImageUrl: string;
};

export const defaultPhotoComparisonContent: PhotoComparisonContent = {
  heroEyebrow: "Photography finishes",
  heroHeading: "Two ways to present a home.",
  heroAccent: "One uncompromising standard.",
  heroBody: "Choose the bright clarity of our Standard Finish or the warmer, architectural-inspired depth of our Editorial Finish. Both are crafted with the same care. The right choice depends on the property and the story it needs to tell.",
  comparisonEyebrow: "See the difference",
  comparisonHeading: "The same home, interpreted with a different visual intention.",
  comparisonBody: "Drag each image to compare the brighter Standard direction with the warmer, more restrained Editorial direction.",
  standardTitle: "Standard Finish",
  standardPositioning: "Bright, polished, and MLS-forward.",
  standardDescription: "Our signature listing finish is designed for clarity, consistency, and immediate impact across MLS, property websites, and social media.",
  standardFeatures: ["Bright and inviting presentation", "Clean, accurate color", "Strong window and exterior visibility", "Broad appeal across property types", "Same-day photo delivery"],
  editorialTitle: "Editorial Finish",
  editorialPositioning: "Refined, dimensional, and design-forward.",
  editorialDescription: "An architectural-inspired treatment that brings greater attention to materials, natural light, tonal depth, and the atmosphere of the space.",
  editorialFeatures: ["Warmer, more natural tonal direction", "Controlled highlights and softer contrast", "Greater emphasis on materials and texture", "Ideal for custom and luxury homes", "Delivery within 48 hours"],
  editorialBadge: "Included with Luxe",
  decisionEyebrow: "Which finish fits?",
  decisionHeading: "Let the property lead the decision.",
  decisionBody: "Standard is our recommendation for most listings. Editorial Finish is designed for homes where architecture, interior design, materials, and atmosphere are central to the marketing story.",
  ctaEyebrow: "Helios Editorial Finish",
  ctaHeading: "Add a more considered finish to your next listing.",
  ctaBody: "Available as a $195 upgrade with Base or Pro photography and included with every Luxe package. Editorial galleries are delivered within 48 hours.",
  primaryLabel: "Book Editorial Finish",
  primaryDestination: "/book",
  secondaryLabel: "Ask which finish fits",
  secondaryDestination: "/inquire",
};

export const defaultPhotoComparisonPairs: PhotoComparisonPairValue[] = [
  ["bathroom", "Luxury bathroom with walnut cabinetry and marble shower"],
  ["staircase", "Modern floating staircase with mountain views"],
  ["kitchen", "Custom kitchen with wood cabinetry and waterfall island"],
].map(([label, alt], position) => ({ id: `default-${label}`, label, editorialStyle: null, alt, caption: "Representative views from the same property. Framing may vary. Drag to compare the overall visual direction.", active: true, position, standardImageStorageKey: null, standardImageUrl: `/photo-finishes/standard-${label}.jpg`, editorialImageStorageKey: null, editorialImageUrl: `/photo-finishes/editorial-${label}.jpg` }));

export const emptyPhotoComparisonContent = Object.fromEntries(
  Object.entries(defaultPhotoComparisonContent).map(([key, value]) => [key, Array.isArray(value) ? [] : ""]),
) as unknown as PhotoComparisonContent;

export async function canUseLegacyPhotoComparison(workspaceId: string) {
  if (tenantContextEnabled()) return false;
  const companies = await prisma.workspace.findMany({ take: 2, select: { id: true } });
  return companies.length === 1 && companies[0].id === workspaceId;
}

function contentFromJson(value: Prisma.JsonValue, defaults: PhotoComparisonContent): PhotoComparisonContent {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
    const candidate = record[key];
    if (Array.isArray(fallback)) return [key, Array.isArray(candidate) ? candidate.filter((item): item is string => typeof item === "string") : fallback];
    return [key, typeof candidate === "string" && candidate.trim() ? candidate : fallback];
  })) as PhotoComparisonContent;
}

export async function getPhotoComparisonPage(workspaceId?: string) {
  const resolvedWorkspaceId = workspaceId || await getPublicWorkspaceId();
  const page = await prisma.photoComparisonPage.findUnique({ where: { workspaceId: resolvedWorkspaceId }, include: { pairs: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } } });
  const legacy = await canUseLegacyPhotoComparison(resolvedWorkspaceId);
  const detailOwned = photoComparisonImageMatchesWorkspace(resolvedWorkspaceId, { key: page?.detailImageStorageKey ?? null, url: page?.detailImageUrl ?? null });
  const ownedPairs = page?.pairs.filter((pair) =>
    photoComparisonImageMatchesWorkspace(resolvedWorkspaceId, { key: pair.standardImageStorageKey, url: pair.standardImageUrl })
    && photoComparisonImageMatchesWorkspace(resolvedWorkspaceId, { key: pair.editorialImageStorageKey, url: pair.editorialImageUrl }),
  ) ?? [];
  return {
    active: detailOwned && (page?.active ?? legacy) && (legacy || Boolean(page?.detailImageUrl && ownedPairs.some((pair) => pair.active))),
    updatedAt: page?.updatedAt ?? null,
    content: page ? contentFromJson(page.content, legacy ? defaultPhotoComparisonContent : emptyPhotoComparisonContent) : legacy ? defaultPhotoComparisonContent : emptyPhotoComparisonContent,
    detailImageStorageKey: detailOwned ? page?.detailImageStorageKey ?? null : null,
    detailImageUrl: detailOwned ? page?.detailImageUrl || (legacy ? "/photo-finishes/editorial-detail.jpg" : "") : "",
    detailImageAlt: page?.detailImageAlt || (legacy ? "Editorial detail photograph of a custom luxury kitchen" : ""),
    pairs: page ? ownedPairs.map((pair) => ({ ...pair, caption: pair.caption || "" })) : legacy ? defaultPhotoComparisonPairs : [],
  };
}
