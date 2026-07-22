import Link from "next/link";

import NewProjectForm from "./NewProjectForm";

export default function NewProjectPage() {
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

      <NewProjectForm />
    </div>
  );
}
