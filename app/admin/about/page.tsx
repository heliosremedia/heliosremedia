import { AdminPageHeader } from "@/app/admin/components/AdminPageLayout";
import { getAboutPageContent } from "@/lib/about-page";
import { prisma } from "@/lib/prisma";
import { teamMemberSelect } from "@/lib/team-members";

import AboutPageManager from "./AboutPageManager";

export const dynamic = "force-dynamic";

export default async function AdminAboutPage() {
  const [content, teamMembers] = await Promise.all([getAboutPageContent(), prisma.teamMember.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: teamMemberSelect })]);
  return <div className="space-y-7"><AdminPageHeader eyebrow="Public presentation" title="About page curation" description="Manage the About hero, company story, founder profile, principles, imagery, and client-experience narrative without editing the site." /><AboutPageManager initialContent={content} initialTeamMembers={teamMembers} /></div>;
}
