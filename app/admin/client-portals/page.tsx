import { prisma } from "@/lib/prisma";
import ClientPortalManager from "./ClientPortalManager";

export const dynamic = "force-dynamic";

export default async function ClientPortalsPage() {
  const portals = await prisma.clientPortal.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, description: true, provider: true, hdphGroupId: true, loginUrl: true, registrationUrl: true, bookingUrl: true, registrationEnabled: true, isDefault: true, active: true, displayOrder: true } });
  return <div className="space-y-7"><section className="border-b border-white/[0.08] pb-7"><p className="eyebrow text-[var(--helios-orange)]">Client access</p><h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">Client portals</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">Discover HDPhotoHub groups and map each company or location to a branded login, registration, and booking experience. Provider-neutral external portals remain available for future platforms.</p></section><section className="grid gap-3 sm:grid-cols-3" aria-label="Portal summary">{[["Total portals",portals.length],["Published / active",portals.filter(portal=>portal.active).length],["Inactive",portals.filter(portal=>!portal.active).length]].map(([label,value])=><div key={label} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><p className="text-[0.56rem] uppercase tracking-[0.15em] text-white/30">{label}</p><p className="mt-3 text-3xl font-light text-white">{value}</p></div>)}</section><ClientPortalManager initialPortals={portals} /></div>;
}
