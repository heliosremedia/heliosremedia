import { prisma } from "@/lib/prisma";
import { MAX_PHOTO_VA_RECIPIENTS, studioPhotoVaRecipients } from "@/lib/studio-photo-va-recipients";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request) {
  return studioPhotoVaRecipients(request, {
    listUsers: async (workspaceId) => (await prisma.photoVaContact.findMany({
      where: { workspaceId, enabled: true },
      select: { teamMember: { select: { id: true, name: true } } },
      orderBy: [{ teamMember: { name: "asc" } }, { teamMemberId: "asc" }],
      take: MAX_PHOTO_VA_RECIPIENTS + 1,
    })).map(({ teamMember }) => ({ id: teamMember.id, displayName: teamMember.name })),
    resolveUser: async (workspaceId, teamMemberId) => {
      const row = await prisma.photoVaContact.findFirst({
        where: { workspaceId, teamMemberId, enabled: true },
        select: { teamMember: { select: { id: true, name: true } }, email: true },
      });
      return row ? { id: row.teamMember.id, displayName: row.teamMember.name, email: row.email } : null;
    },
  });
}
