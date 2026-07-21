import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import UserManager from "./UserManager";

export const dynamic = "force-dynamic";
export default async function UsersPage() {
  const session = await requireAdminSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") redirect("/admin");
  const [users, invitations] = await Promise.all([prisma.adminUser.findMany({ orderBy: [{ active: "desc" }, { displayName: "asc" }], select: { id: true, email: true, displayName: true, role: true, active: true, lastLoginAt: true, createdAt: true } }), prisma.adminInvitation.findMany({ where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, email: true, displayName: true, role: true, expiresAt: true, createdAt: true } })]);
  return <div className="space-y-7"><section className="border-b border-white/[0.08] pb-7"><p className="eyebrow text-[var(--helios-orange)]">Access control</p><h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">Accounts & users</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Invite teammates, assign the minimum access they need, and deactivate accounts while preserving the audit trail.</p></section><UserManager initialUsers={users.map(item => ({ ...item, lastLoginAt: item.lastLoginAt?.toISOString() || null, createdAt: item.createdAt.toISOString() }))} invitations={invitations.map(item => ({ ...item, expiresAt: item.expiresAt.toISOString(), createdAt: item.createdAt.toISOString() }))} currentUserId={session.userId} currentRole={session.role} /></div>;
}
