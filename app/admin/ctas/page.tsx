import { prisma } from "@/lib/prisma";
import CtaManager, { type AdminCta } from "./CtaManager";

export const dynamic = "force-dynamic";

export default async function AdminCtasPage() {
  const ctas = await prisma.callToAction.findMany({ orderBy: { createdAt: "asc" }, include: { placements: { select: { slot: true } } } });
  const serialized: AdminCta[] = ctas.map((cta) => ({ ...cta, slots: cta.placements.map(({ slot }) => slot), createdAt: cta.createdAt.toISOString(), updatedAt: cta.updatedAt.toISOString() }));
  return <div className="space-y-7"><section className="border-b border-white/[0.08] pb-7"><p className="eyebrow text-[var(--helios-orange)]">Conversion system</p><h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">Call-to-action management</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Create reusable conversion messages, assign them to site placements, and route every booking action through the global booking URL.</p></section><CtaManager initialCtas={serialized} /></div>;
}
