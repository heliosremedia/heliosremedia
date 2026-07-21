import type { TeamMemberCategory } from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";

export const teamMemberCategories = [
  "LEADERSHIP",
  "PRODUCTION",
  "POST_PRODUCTION",
  "CLIENT_CARE",
  "MARKETING",
  "OPERATIONS",
] as const satisfies TeamMemberCategory[];

export const teamMemberCategoryLabels: Record<TeamMemberCategory, string> = {
  LEADERSHIP: "Leadership",
  PRODUCTION: "Production",
  POST_PRODUCTION: "Post-production",
  CLIENT_CARE: "Client care",
  MARKETING: "Marketing",
  OPERATIONS: "Operations",
};

export type PublicTeamMember = {
  id: string;
  name: string;
  title: string;
  biography: string;
  category: TeamMemberCategory;
  portraitUrl: string | null;
  portraitAlt: string | null;
  focalX: number;
  focalY: number;
  displayOrder: number;
};

export const teamMemberSelect = {
  id: true,
  name: true,
  title: true,
  biography: true,
  category: true,
  portraitStorageKey: true,
  portraitUrl: true,
  portraitAlt: true,
  focalX: true,
  focalY: true,
  displayOrder: true,
  visible: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getVisibleTeamMembers(): Promise<PublicTeamMember[]> {
  try {
    return await prisma.teamMember.findMany({
      where: { visible: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        title: true,
        biography: true,
        category: true,
        portraitUrl: true,
        portraitAlt: true,
        focalX: true,
        focalY: true,
        displayOrder: true,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("Team members unavailable.", error);
    return [];
  }
}
