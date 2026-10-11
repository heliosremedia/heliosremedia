import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { prisma } from "@/lib/prisma";

import NewProjectForm from "./NewProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ inquiry?: string }> }) {
  const session = await requireAdminSession();
  if (!["OWNER", "ADMIN", "EDITOR"].includes(session.role)) notFound();
  const { inquiry: inquiryId } = await searchParams;
  const sourceInquiry = inquiryId ? await prisma.inquiry.findFirst({ where: { id: inquiryId, ...await getContentOwnershipScope(session.workspaceId) }, select: { id: true, name: true, propertyAddress: true, city: true, state: true, requestedServices: { where: { service: { workspaceId: session.workspaceId } }, include: { service: { select: { name: true } } } } } }) : null;
  if (inquiryId && !sourceInquiry) notFound();
  const location = [sourceInquiry?.city, sourceInquiry?.state].filter(Boolean).join(", ");
  const address = sourceInquiry?.propertyAddress?.trim() ?? "";
  const initialValues = sourceInquiry ? {
    title: address ? address.slice(0, 120) : "New project",
    city: sourceInquiry.city ?? "",
    state: sourceInquiry.state ?? "Colorado",
    locationLabel: location,
  } : undefined;
  const source = sourceInquiry ? { id: sourceInquiry.id, name: sourceInquiry.name, services: sourceInquiry.requestedServices.map(({ service }) => service.name) } : undefined;
  return (
    <div className="space-y-7">
      <section className="border-b border-white/[0.08] pb-7">
        <Link
          href="/admin/projects"
          className="admin-btn-link"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
          >
            <path
              d="m15 6-6 6 6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          Back to projects
        </Link>

        <p className="eyebrow mt-6 text-[var(--helios-orange)]">
          New project
        </p>

        <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">
          Create a portfolio project
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
          Start with the essential project information. Media,
          services, and publishing controls come next.
        </p>
      </section>

      <NewProjectForm requestId={randomUUID()} initialValues={initialValues} sourceInquiry={source} />
    </div>
  );
}
