import { AdminPageHeader } from "@/app/admin/components/AdminPageLayout";
import { prisma } from "@/lib/prisma";
import CtaManager, { type AdminCta } from "./CtaManager";

export const dynamic = "force-dynamic";

export default async function AdminCtasPage() {
  const ctas = await prisma.callToAction.findMany({ orderBy: { createdAt: "asc" }, include: { placements: { select: { slot: true } } } });
  const serialized: AdminCta[] = ctas.map((cta) => ({ ...cta, slots: cta.placements.map(({ slot }) => slot), createdAt: cta.createdAt.toISOString(), updatedAt: cta.updatedAt.toISOString() }));
  return <div className="space-y-7"><AdminPageHeader eyebrow="Conversion system" title="Call-to-action management" description="Create reusable conversion messages, assign them to site placements, and route every booking action through the global booking URL." /><CtaManager initialCtas={serialized} /></div>;
}
