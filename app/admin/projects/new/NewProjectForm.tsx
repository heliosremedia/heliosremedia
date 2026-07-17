"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useState,
} from "react";
import { useFormStatus } from "react-dom";

import {
  createProject,
  type CreateProjectState,
} from "./actions";

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

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--helios-orange)] px-7 text-[0.66rem] font-semibold uppercase tracking-[0.17em] text-white shadow-[0_10px_30px_rgba(217,107,43,0.18)] transition duration-300 hover:-translate-y-0.5 hover:bg-[var(--helios-orange-hover)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
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
  "mt-2 min-h-12 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[var(--helios-orange)]/45 focus:bg-black/30";

const labelClasses =
  "text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/45";

export default function NewProjectForm() {
  const [state, formAction] = useActionState(
    createProject,
    initialState,
  );

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  useEffect(() => {
    if (!slugEdited) {
      setSlug(slugify(title));
    }
  }, [title, slugEdited]);

  return (
    <form action={formAction}>
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

              <p className="mt-1 text-sm leading-6 text-white/35">
                Give the project a clear title and website address.
              </p>
            </div>

            <div className="grid gap-5 p-5 sm:p-6">
              <label>
                <span className={labelClasses}>
                  Project title
                  <span className="ml-1 text-[var(--helios-orange)]">
                    *
                  </span>
                </span>

                <input
                  required
                  autoFocus
                  type="text"
                  name="title"
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  placeholder="Mountain Modern in Fort Collins"
                  className={inputClasses}
                />
              </label>

              <label>
                <span className={labelClasses}>
                  Portfolio URL
                </span>

                <div className="mt-2 flex min-h-12 overflow-hidden rounded-xl border border-white/[0.08] bg-black/20 transition focus-within:border-[var(--helios-orange)]/45">
                  <span className="flex items-center border-r border-white/[0.08] px-4 text-sm text-white/25">
                    /portfolio/
                  </span>

                  <input
                    type="text"
                    name="slug"
                    value={slug}
                    onChange={(event) => {
                      setSlugEdited(true);
                      setSlug(slugify(event.target.value));
                    }}
                    placeholder="mountain-modern-fort-collins"
                    className="min-w-0 flex-1 border-0 bg-transparent px-4 text-sm text-white outline-none placeholder:text-white/20"
                  />
                </div>

                <p className="mt-2 text-xs leading-5 text-white/25">
                  We will automatically make this unique if another
                  project already uses it.
                </p>
              </label>

              <label>
                <span className={labelClasses}>
                  Short description
                </span>

                <textarea
                  name="shortDescription"
                  rows={4}
                  placeholder="A concise introduction for project cards and portfolio previews."
                  className={`${inputClasses} resize-y py-3`}
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6">
              <h2 className="text-2xl font-normal text-white">
                Location
              </h2>

              <p className="mt-1 text-sm leading-6 text-white/35">
                Add the location information visitors should see.
              </p>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <label>
                <span className={labelClasses}>City</span>

                <input
                  type="text"
                  name="city"
                  placeholder="Fort Collins"
                  className={inputClasses}
                />
              </label>

              <label>
                <span className={labelClasses}>State</span>

                <input
                  type="text"
                  name="state"
                  defaultValue="Colorado"
                  placeholder="Colorado"
                  className={inputClasses}
                />
              </label>

              <label className="sm:col-span-2">
                <span className={labelClasses}>
                  Display location
                </span>

                <input
                  type="text"
                  name="locationLabel"
                  placeholder="Old Town Fort Collins, Colorado"
                  className={inputClasses}
                />

                <p className="mt-2 text-xs leading-5 text-white/25">
                  Optional. This replaces the city and state wherever
                  the project location is displayed publicly.
                </p>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6">
              <h2 className="text-2xl font-normal text-white">
                Classification
              </h2>

              <p className="mt-1 text-sm leading-6 text-white/35">
                Organize the project for future filtering and
                portfolio categories.
              </p>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <label>
                <span className={labelClasses}>
                  Project type
                </span>

                <select
                  name="projectType"
                  defaultValue="Listing Media"
                  className={inputClasses}
                >
                  <option value="">Select project type</option>
                  <option value="Listing Media">
                    Listing Media
                  </option>
                  <option value="Agent Branding">
                    Agent Branding
                  </option>
                  <option value="Community Content">
                    Community Content
                  </option>
                  <option value="Commercial">
                    Commercial
                  </option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label>
                <span className={labelClasses}>
                  Property type
                </span>

                <select
                  name="propertyType"
                  defaultValue=""
                  className={inputClasses}
                >
                  <option value="">Select property type</option>
                  <option value="Single-Family Home">
                    Single-Family Home
                  </option>
                  <option value="Luxury Home">Luxury Home</option>
                  <option value="Townhome">Townhome</option>
                  <option value="Condominium">Condominium</option>
                  <option value="Land">Land</option>
                  <option value="Farm and Ranch">
                    Farm and Ranch
                  </option>
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

            <p className="mt-3 text-sm leading-6 text-white/40">
              This creates a private draft. Nothing will appear on
              the public website until you publish it.
            </p>

            <div className="mt-6 space-y-3 border-t border-white/[0.08] pt-5">
              {[
                ["01", "Project details", true],
                ["02", "Media", false],
                ["03", "Services", false],
                ["04", "Review and publish", false],
              ].map(([number, label, active]) => (
                <div
                  key={number as string}
                  className="flex items-center gap-3"
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border text-[0.58rem] font-semibold ${
                      active
                        ? "border-[var(--helios-orange)]/40 bg-[var(--helios-orange)]/10 text-[var(--helios-orange-hover)]"
                        : "border-white/[0.08] text-white/25"
                    }`}
                  >
                    {number}
                  </span>

                  <span
                    className={`text-xs ${
                      active ? "text-white/75" : "text-white/30"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-3">
              <SubmitButton />

              <Link
                href="/admin/projects"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/[0.08] px-5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/40 transition hover:border-white/20 hover:text-white"
              >
                Cancel
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}