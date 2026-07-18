import { prisma } from "@/lib/prisma";

import FaqManager, { type AdminFaqCategory } from "./FaqManager";

export const dynamic = "force-dynamic";

export default async function AdminFaqPage() {
  const categories = await prisma.faqCategory.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      displayOrder: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      faqs: {
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          categoryId: true,
          question: true,
          answer: true,
          displayOrder: true,
          published: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  const serialized: AdminFaqCategory[] = categories.map((category) => ({
    ...category,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    faqs: category.faqs.map((faq) => ({
      ...faq,
      createdAt: faq.createdAt.toISOString(),
      updatedAt: faq.updatedAt.toISOString(),
    })),
  }));

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-[var(--helios-orange)]">Knowledge base</p>
          <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">
            FAQ management
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
            Organize customer questions into reusable categories, refine the
            answers, and control exactly what appears on the public website.
          </p>
        </div>
        <p className="max-w-xs text-xs leading-5 text-white/25 sm:text-right">
          Draft answers stay private until published. Category and question
          ordering is reflected immediately on the public FAQ page.
        </p>
      </section>

      <FaqManager initialCategories={serialized} />
    </div>
  );
}
