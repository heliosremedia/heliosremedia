import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";

import ServiceManager, { type AdminService } from "./ServiceManager";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const services = await prisma.service.findMany({
    orderBy: [
      {
        displayOrder: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      heroImageStorageKey: true,
      heroImageAlt: true,
      displayOrder: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          projects: true,
        },
      },
    },
  });

  const serializedServices: AdminService[] = services.map((service) => ({
    ...service,
    heroImageUrl: service.heroImageStorageKey
      ? getPublicAssetUrl(service.heroImageStorageKey)
      : null,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-[var(--helios-orange)]">
            Platform taxonomy
          </p>

          <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">
            Services management
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
            Define the capabilities Helios delivers, control their portfolio
            order, and manage which services are available for new projects.
          </p>
        </div>

        <p className="max-w-xs text-xs leading-5 text-white/25 sm:text-right">
          Services power project assignments, public filters, and future
          performance reporting.
        </p>
      </section>

      <ServiceManager initialServices={serializedServices} />
    </div>
  );
}
