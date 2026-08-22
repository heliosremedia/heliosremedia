import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicWorkspaceId } from "@/lib/public-workspace";

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
].map(([label, alt], position) => ({ id: `default-${label}`, label, alt, caption: "Representative views from the same property. Framing may vary. Drag to compare the overall visual direction.", active: true, position, standardImageStorageKey: null, standardImageUrl: `/photo-finishes/standard-${label}.jpg`, editorialImageStorageKey: null, editorialImageUrl: `/photo-finishes/editorial-${label}.jpg` }));

function contentFromJson(value: Prisma.JsonValue): PhotoComparisonContent {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(defaultPhotoComparisonContent).map(([key, fallback]) => {
    const candidate = record[key];
    if (Array.isArray(fallback)) return [key, Array.isArray(candidate) ? candidate.filter((item): item is string => typeof item === "string") : fallback];
    return [key, typeof candidate === "string" && candidate.trim() ? candidate : fallback];
  })) as PhotoComparisonContent;
}

export async function getPhotoComparisonPage(workspaceId?: string) {
  const resolvedWorkspaceId = workspaceId || await getPublicWorkspaceId();
  const page = await prisma.photoComparisonPage.findUnique({ where: { workspaceId: resolvedWorkspaceId }, include: { pairs: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } } });
  return {
    active: page?.active ?? true,
    content: page ? contentFromJson(page.content) : defaultPhotoComparisonContent,
    detailImageStorageKey: page?.detailImageStorageKey ?? null,
    detailImageUrl: page?.detailImageUrl || "/photo-finishes/editorial-detail.jpg",
    detailImageAlt: page?.detailImageAlt || "Editorial detail photograph of a custom luxury kitchen",
    pairs: page?.pairs.length ? page.pairs.map((pair) => ({ ...pair, caption: pair.caption || "" })) : defaultPhotoComparisonPairs,
  };
}
