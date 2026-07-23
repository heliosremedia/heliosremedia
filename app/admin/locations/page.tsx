import { prisma } from "@/lib/prisma";

import LocationPageManager, { type AdminLocationPage } from "./LocationPageManager";

export const dynamic = "force-dynamic";

export default async function LocalPagesAdminPage() {
  const locations = await prisma.locationPage.findMany({
    orderBy: [{ displayOrder: "asc" }, { city: "asc" }],
  });

  const serialized: AdminLocationPage[] = locations.map((location) => ({
    ...location,
    localDetails: Array.isArray(location.localDetails)
      ? location.localDetails.filter(
          (detail): detail is string => typeof detail === "string",
        )
      : [],
    createdAt: location.createdAt.toISOString(),
    updatedAt: location.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-[var(--helios-orange)]">Local search presence</p>
          <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">
            Local pages
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
            Build, review, publish, and organize city landing pages. Published
            pages automatically join the website footer, location navigation,
            structured data, and sitemap.
          </p>
        </div>
        <p className="max-w-xs text-xs leading-5 text-white/25 sm:text-right">
          New pages begin as drafts so local details can be verified before
          search engines and visitors see them.
        </p>
      </section>

      <LocationPageManager initialLocations={serialized} />
    </div>
  );
}
