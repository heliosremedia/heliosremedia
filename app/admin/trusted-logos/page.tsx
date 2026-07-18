import { prisma } from "@/lib/prisma";

import TrustedLogoManager, { type AdminTrustedLogo } from "./TrustedLogoManager";

export const dynamic = "force-dynamic";

export default async function TrustedLogosPage() {
  const logos = await prisma.trustedLogo.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] });
  const serialized: AdminTrustedLogo[] = logos.map((logo) => ({ ...logo, createdAt: logo.createdAt.toISOString(), updatedAt: logo.updatedAt.toISOString() }));
  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow text-[var(--helios-orange)]">Brand relationships</p><h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">Trusted-by management</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Manage the brokerages, builders, and professional brands featured across the public Helios experience.</p></div>
        <p className="max-w-xs text-xs leading-5 text-white/25 sm:text-right">Every logo includes a real organization name for accessibility, optional destination link, publishing state, and reusable brand metadata.</p>
      </section>
      <TrustedLogoManager initialLogos={serialized} />
    </div>
  );
}
