import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import ClientDirectory from "./ClientDirectory";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const session = await requireAdminSession();
  const clients = await prisma.communicationClient.findMany({
    orderBy: [{ displayName: "asc" }, { email: "asc" }],
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
      lastSyncedAt: true,
    },
  });

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
      <ClientDirectory
        initialClients={clients.map((client) => ({
          ...client,
          lastSyncedAt: client.lastSyncedAt.toISOString(),
        }))}
        canSync={session.role === "OWNER" || session.role === "ADMIN"}
      />
    </div>
  );
}
