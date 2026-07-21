"use client";

import { useEffect } from "react";
import Link from "next/link";

type AdminErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function AdminError({ error, unstable_retry }: AdminErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="flex min-h-[70vh] items-center px-6 py-16 sm:px-10 lg:px-14">
      <div className="w-full max-w-3xl rounded-[1.6rem] border border-white/[0.08] bg-[#111111] p-8 shadow-2xl shadow-black/20 sm:p-12">
        <p className="text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-[var(--helios-orange)]">
          Workspace interrupted
        </p>
        <h1 className="mt-5 max-w-2xl font-display text-4xl font-light leading-tight tracking-[-0.04em] text-white sm:text-5xl">
          This part of the admin console could not load.
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-white/38">
          Your saved project data is unchanged. Retry the request, or return to
          the project workspace and continue from there.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={unstable_retry}
            className="admin-btn-primary"
          >
            Try again
          </button>
          <Link
            href="/admin/projects"
            className="admin-btn-secondary"
          >
            Return to projects
          </Link>
        </div>
      </div>
    </section>
  );
}
