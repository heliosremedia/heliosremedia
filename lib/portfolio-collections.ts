export type PortfolioCollectionService = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  archivedAt?: Date | string | null;
};

export function portfolioCollectionAnchor(serviceId: string) {
  return `collection-${serviceId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function buildPublicPortfolioCollections<
  TMedia extends { serviceId: string },
>(services: PortfolioCollectionService[], media: TMedia[]) {
  return services
    .filter((service) => service.active && !service.archivedAt)
    .map((service) => ({
      service,
      anchor: portfolioCollectionAnchor(service.id),
      media: media.filter((item) => item.serviceId === service.id),
    }))
    .filter((collection) => collection.media.length > 0);
}
