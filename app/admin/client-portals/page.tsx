import { prisma } from "@/lib/prisma";
import ClientPortalManager from "./ClientPortalManager";

export const dynamic = "force-dynamic";

export default async function ClientPortalsPage() {
  const portals = await prisma.clientPortal.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, description: true, provider: true, hdphGroupId: true, loginUrl: true, registrationUrl: true, bookingUrl: true, registrationEnabled: true, isDefault: true, active: true, displayOrder: true } });
  return <div className="space-y-7"><section className="border-b border-white/[0.08] pb-7"><p className="eyebrow text-[var(--helios-orange)]">Client access</p><h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">Client portals</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">Discover HDPhotoHub groups and map each company or location to a branded login, registration, and booking experience. Provider-neutral external portals remain available for future platforms.</p></section><ClientPortalManager initialPortals={portals} /></div>;
}
