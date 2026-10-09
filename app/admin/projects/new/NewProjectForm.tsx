"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

import { PROJECT_TYPES } from "@/lib/project-types";

import { createProject, type CreateProjectState } from "./actions";

const initialState: CreateProjectState = {
  error: null,
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function SubmitButton({ paused }: { paused: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || paused}
      className="admin-btn-primary"
    >
      {pending ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/35 border-t-white" />
          Creating project
        </>
      ) : (
        <>
          Create draft
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
          >
            <path
              d="m9 6 6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </>
      )}
    </button>
  );
}

const inputClasses =
  "mt-2 min-h-12 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none transition placeholder:text-white/65 focus:border-[var(--helios-orange)]/45 focus:bg-black/30";

const labelClasses =
  "text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/65";

export default function NewProjectForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [submissionId] = useState(requestId);
  const [state, formAction, pending] = useActionState(async (previous: CreateProjectState, data: FormData) => {
    try { return await createProject(previous, data); }
    catch { return { error: "The creation result could not be confirmed. Your form is preserved. Check Projects before starting another draft.", requiresReview: true }; }
  }, initialState);
  useEffect(() => { if (state.projectId) router.push(`/admin/projects/${state.projectId}`); }, [router, state.projectId]);
  const [fields, setFields] = useState({ shortDescription: "", city: "", state: "Colorado", locationLabel: "", projectType: "Listing Media", propertyType: "" });
  const field = (name: keyof typeof fields) => ({ value: fields[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setFields(current => ({ ...current, [name]: event.target.value })) });

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <form action={formAction}>
      <input type="hidden" name="requestId" value={submissionId} />
      {state.projectId && <p role="status">Draft created. <Link href={`/admin/projects/${state.projectId}`}>Open project</Link></p>}
      {state.requiresReview && <p role="status" className="mb-5 text-sm text-amber-100">Creation is paused. Copy any text you need, then <Link href="/admin/projects" className="underline">check Projects</Link>.</p>}
      <fieldset disabled={pending || Boolean(state.projectId)} className="min-w-0">
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-6">
          {state.error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm leading-6 text-red-200"
            >
              {state.error}
            </div>
          ) : null}

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6">
              <h2 className="text-2xl font-normal text-white">
                Project identity
              </h2>

              <p className="mt-1 text-sm leading-6 text-white/65">
                Give the project a clear title and website address.
              </p>
            </div>

            <div className="grid gap-5 p-5 sm:p-6">
              <label>
                <span className={labelClasses}>
                  Project title
                  <span className="ml-1 text-[var(--helios-orange)]">*</span>
                </span>

                <input
                  required
                  autoFocus
                  type="text"
                  name="title"
                  maxLength={120}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Mountain Modern in Fort Collins"
                  className={inputClasses}
                />
              </label>

              <label>
                <span className={labelClasses}>Portfolio URL</span>

                <div className="mt-2 flex min-h-12 overflow-hidden rounded-xl border border-white/[0.08] bg-black/20 transition focus-within:border-[var(--helios-orange)]/45">
                  <span className="flex items-center border-r border-white/[0.08] px-4 text-sm text-white/65">
                    /portfolio/
                  </span>

                  <input
                    type="text"
                    name="slug"
                  maxLength={140}
                    value={slugEdited ? slug : slugify(title)}
                    onChange={(event) => {
                      setSlugEdited(true);
                      setSlug(slugify(event.target.value));
                    }}
                    placeholder="mountain-modern-fort-collins"
                    className="min-w-0 flex-1 border-0 bg-transparent px-4 text-sm text-white outline-none placeholder:text-white/65"
                  />
                </div>

                <p className="mt-2 text-xs leading-5 text-white/65">
                  We will automatically make this unique if another project
                  already uses it.
                </p>
              </label>

              <div>
                <label htmlFor="new-project-short-description" className={labelClasses}>Short description</label>

                <textarea
                  id="new-project-short-description"
                  name="shortDescription"
                  maxLength={320}
                  {...field("shortDescription")}
                  rows={4}
                  placeholder="A concise introduction for project cards and portfolio previews."
                  className={`${inputClasses} resize-y py-3`}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6">
              <h2 className="text-2xl font-normal text-white">Location</h2>

              <p className="mt-1 text-sm leading-6 text-white/65">
                Add the location information visitors should see.
              </p>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <label>
                <span className={labelClasses}>City</span>

                <input
                  type="text"
                  name="city"
                  maxLength={120}
                  {...field("city")}
                  placeholder="Fort Collins"
                  className={inputClasses}
                />
              </label>

              <label>
                <span className={labelClasses}>State</span>

                <input
                  type="text"
                  name="state"
                  maxLength={120}
                  {...field("state")}
                  placeholder="Colorado"
                  className={inputClasses}
                />
              </label>

              <label className="sm:col-span-2">
                <span className={labelClasses}>Display location</span>

                <input
                  type="text"
                  name="locationLabel"
                  maxLength={180}
                  {...field("locationLabel")}
                  placeholder="Old Town Fort Collins, Colorado"
                  className={inputClasses}
                />

                <p className="mt-2 text-xs leading-5 text-white/65">
                  Optional. This replaces the city and state wherever the
                  project location is displayed publicly.
                </p>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6">
              <h2 className="text-2xl font-normal text-white">
                Classification
              </h2>

              <p className="mt-1 text-sm leading-6 text-white/65">
                Organize the project for future filtering and portfolio
                categories.
              </p>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <label>
                <span className={labelClasses}>Project type</span>

                <select
                  name="projectType"
                  {...field("projectType")}
                  className={inputClasses}
                >
                  <option value="">Select project type</option>
                  {PROJECT_TYPES.map((projectType) => (
                    <option key={projectType} value={projectType}>
                      {projectType}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className={labelClasses}>Property type</span>

                <select
                  name="propertyType"
                  {...field("propertyType")}
                  className={inputClasses}
                >
                  <option value="">Select property type</option>
                  <option value="Single-Family Home">Single-Family Home</option>
                  <option value="Luxury Home">Luxury Home</option>
                  <option value="Townhome">Townhome</option>
                  <option value="Condominium">Condominium</option>
                  <option value="Land">Land</option>
                  <option value="Farm and Ranch">Farm and Ranch</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>
          </section>
        </div>

        <aside className="xl:sticky xl:top-[6.5rem] xl:self-start">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-[var(--helios-orange)]">
              Step 1 of 4
            </p>

            <h2 className="mt-3 text-2xl font-normal text-white">
              Project details
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/65">
              This creates a private draft. Nothing will appear on the public
              website until you publish it.
            </p>

            <div className="mt-6 space-y-3 border-t border-white/[0.08] pt-5">
              {[
                ["01", "Project details", true],
                ["02", "Media", false],
                ["03", "Services", false],
                ["04", "Review and publish", false],
              ].map(([number, label, active]) => (
                <div key={number as string} className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border text-[0.58rem] font-semibold ${
                      active
                        ? "border-[var(--helios-orange)]/40 bg-[var(--helios-orange)]/10 text-[var(--helios-orange-hover)]"
                        : "border-white/[0.08] text-white/65"
                    }`}
                  >
                    {number}
                  </span>

                  <span
                    className={`text-xs ${
                      active ? "text-white/75" : "text-white/65"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-3">
              <SubmitButton paused={Boolean(state.requiresReview || state.projectId)} />

              <Link
                href="/admin/projects"
                className="admin-btn-secondary"
              >
                Cancel
              </Link>
            </div>
          </div>
        </aside>
      </div>
      </fieldset>
    </form>
  );
}
