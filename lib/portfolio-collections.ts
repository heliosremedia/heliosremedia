import { mediaIntentAnchor } from "@/lib/portfolio-discovery-core";

export type PortfolioCollectionService = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  archivedAt?: Date | string | null;
};

export function portfolioCollectionAnchor(service: { id: string; slug: string }) {
  return mediaIntentAnchor(service.slug) || `collection-${service.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function buildPublicPortfolioCollections<
  TMedia extends { serviceId: string },
>(services: PortfolioCollectionService[], media: TMedia[]) {
  return services
    .filter((service) => service.active && !service.archivedAt)
    .map((service) => ({
      service,
      anchor: portfolioCollectionAnchor(service),
      media: media.filter((item) => item.serviceId === service.id),
    }))
    .filter((collection) => collection.media.length > 0);
}
