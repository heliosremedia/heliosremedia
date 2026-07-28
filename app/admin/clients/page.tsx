import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import ClientDirectory from "./ClientDirectory";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const session = await requireAdminSession();
  const [clients, groups] = await Promise.all([
    prisma.communicationClient.findMany({
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        lastSyncedAt: true,
        normalizedEmail: true,
        emailSubscribed: true,
        archivedAt: true,
        groupMemberships: { select: { groupId: true } },
      },
    }),
    prisma.communicationGroup.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        _count: { select: { memberships: true } },
      },
    }),
  ]);
  const preferences = await prisma.marketingEmailPreference.findMany({
    where: { normalizedEmail: { in: clients.map(client => client.normalizedEmail) } },
    select: { normalizedEmail: true, status: true, effectiveAt: true, source: true },
  });
  const preferenceByEmail = new Map(preferences.map(preference => [preference.normalizedEmail, preference]));

  return (
    <div className="space-y-7">
      <section className="border-b border-white/[0.08] pb-7">
        <p className="eyebrow text-[var(--helios-orange)]">Client directory</p>
        <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">
          Clients
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">
          A streamlined contact directory synchronized manually from HDPhotoHub.
        </p>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Client summary">
        {[
          ["Total clients", clients.length],
          ["Active clients", clients.filter(client => !client.archivedAt).length],
          ["Email eligible", clients.filter(client => client.emailSubscribed && !client.archivedAt).length],
          ["Client groups", groups.length],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><p className="text-[0.56rem] uppercase tracking-[0.15em] text-white/30">{label}</p><p className="mt-3 text-3xl font-light text-white">{value}</p></div>)}
      </section>
      <ClientDirectory
        initialClients={clients.map((client) => ({
          ...client,
          lastSyncedAt: client.lastSyncedAt.toISOString(),
          groupIds: client.groupMemberships.map((membership) => membership.groupId),
          emailStatus: preferenceByEmail.get(client.normalizedEmail)?.status
            ?? (client.emailSubscribed ? "UNKNOWN" : "UNSUBSCRIBED"),
          emailStatusEffectiveAt: preferenceByEmail.get(client.normalizedEmail)?.effectiveAt.toISOString() ?? null,
          emailStatusSource: preferenceByEmail.get(client.normalizedEmail)?.source ?? null,
          groupMemberships: undefined,
          archivedAt: undefined,
        }))}
        initialGroups={groups.map((group) => ({
          id: group.id,
          name: group.name,
          clientCount: group._count.memberships,
        }))}
        canManage={session.role === "OWNER" || session.role === "ADMIN"}
      />
    </div>
  );
}
