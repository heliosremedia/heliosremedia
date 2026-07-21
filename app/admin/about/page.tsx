import { getAboutPageContent } from "@/lib/about-page";
import { prisma } from "@/lib/prisma";
import { teamMemberSelect } from "@/lib/team-members";

import AboutPageManager from "./AboutPageManager";

export const dynamic = "force-dynamic";

export default async function AdminAboutPage() {
  const [content, teamMembers] = await Promise.all([getAboutPageContent(), prisma.teamMember.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: teamMemberSelect })]);
  return <div className="space-y-7"><section className="border-b border-white/[0.08] pb-7"><p className="eyebrow text-[var(--helios-orange)]">Public presentation</p><h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">About page curation</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Manage the About hero, company story, founder profile, principles, imagery, and client-experience narrative without editing the site.</p></section><AboutPageManager initialContent={content} initialTeamMembers={teamMembers} /></div>;
}
