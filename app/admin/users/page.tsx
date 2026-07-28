import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth/session";
import UserManager from "./UserManager";
import ProfileManager from "./ProfileManager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await requireAdminSession();
  const canManageWorkspace = session.role === "OWNER" || session.role === "ADMIN";
  const [users, invitations, profile] = await Promise.all([
    prisma.adminUser.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: [{ active: "desc" }, { displayName: "asc" }],
      select: { id: true, email: true, displayName: true, title: true, firstName: true, lastName: true, phone: true, disciplines: true, role: true, active: true, lastLoginAt: true, createdAt: true },
    }),
    prisma.adminInvitation.findMany({
      where: { workspaceId: session.workspaceId, acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, displayName: true, title: true, role: true, expiresAt: true, createdAt: true },
    }),
    prisma.adminUser.findUniqueOrThrow({
      where: { id: session.userId },
      select: { firstName: true, lastName: true, displayName: true, title: true, email: true, phone: true, notificationPreferences: true },
    }),
  ]);
  return <div className="space-y-7">
    <section className="border-b border-white/[0.08] pb-7">
      <p className="eyebrow text-[var(--helios-orange)]">Access control</p>
      <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">Accounts & users</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Manage your profile, invite teammates, assign the minimum access they need, and deactivate accounts while preserving the audit trail.</p>
    </section>
    <ProfileManager initialProfile={profile}/>
    {canManageWorkspace&&<UserManager initialUsers={users.map(item => ({ ...item, lastLoginAt: item.lastLoginAt?.toISOString() || null, createdAt: item.createdAt.toISOString() }))} invitations={invitations.map(item => ({ ...item, expiresAt: item.expiresAt.toISOString(), createdAt: item.createdAt.toISOString() }))} currentUserId={session.userId} currentRole={session.role}/>}
  </div>;
}
