import type { MediaCategory } from "@/lib/media-collections";

type PortfolioServiceIdentity = {
  name: string;
  slug: string;
};

export function getServiceMediaCategories(
  service: PortfolioServiceIdentity | null | undefined,
): MediaCategory[] {
  if (!service) {
    return [];
  }

  const identity = `${service.name} ${service.slug}`.toLowerCase();

  if (identity.includes("drone") || identity.includes("aerial")) {
    return ["DRONE_PHOTOGRAPHY"];
  }

  if (identity.includes("cinematic") || identity.includes("film")) {
    return ["CINEMATIC_FILM"];
  }

  if (identity.includes("vertical") || identity.includes("reel")) {
    return ["VERTICAL_REEL"];
  }

  if (identity.includes("agent") && identity.includes("brand")) {
    return ["AGENT_BRANDING"];
  }

  if (identity.includes("social") || identity.includes("content")) {
    return ["SOCIAL_CONTENT"];
  }

  if (identity.includes("floor")) {
    return ["FLOOR_PLAN"];
  }

  if (identity.includes("matterport") || identity.includes("3d")) {
    return ["MATTERPORT"];
  }

  if (identity.includes("property") && identity.includes("website")) {
    return ["PROPERTY_WEBSITE"];
  }

  if (identity.includes("photo")) {
    return ["PHOTOGRAPHY"];
  }

  return [];
}
