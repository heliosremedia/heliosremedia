"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

export type ProjectDetailsDraft = {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  city: string;
  state: string;
  locationLabel: string;
  projectType: string;
  propertyType: string;
  seoTitle: string;
  seoDescription: string;
  listingAgent: string;
  brokerage: string;
  builder: string;
  architect: string;
  interiorDesigner: string;
  squareFeet: string;
  bedrooms: string;
  bathrooms: string;
  lotSize: string;
  neighborhood: string;
  propertyWebsiteUrl: string;
};

type ProjectDetailsEditorProps = {
  projectId: string;
  initialData: ProjectDetailsDraft;
  statusLabel: string;
};

type ProjectDetailsResponse = {
  success: boolean;
  error?: string;
  project?: {
    id: string;
    title: string;
    slug: string;
  };
};

const inputClasses =
  "mt-2 min-h-12 w-full rounded-xl border border-white/[0.08] bg-black/25 px-4 text-sm text-white outline-none transition placeholder:text-white/18 focus:border-[var(--helios-orange)]/45 focus:bg-black/35";
const labelClasses =
  "text-[0.58rem] font-semibold uppercase tracking-[0.17em] text-white/35";

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function Field({
  label,
  children,
  className = "",
  detail,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  detail?: string;
}) {
  return (
    <label className={className}>
      <span className={labelClasses}>{label}</span>
      {children}
      {detail && (
        <span className="mt-2 block text-xs text-white/22">{detail}</span>
      )}
    </label>
  );
}

function SectionHeading({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6">
      <div className="flex items-start gap-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--helios-orange)]/25 bg-[var(--helios-orange)]/[0.07] text-[0.54rem] font-semibold text-[var(--helios-orange-hover)]">
          {number}
        </span>
        <div>
          <h3 className="text-xl font-normal text-white">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-white/30">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function ProjectDetailsEditor({
  projectId,
  initialData,
  statusLabel,
}: ProjectDetailsEditorProps) {
  const router = useRouter();
  const [savedData, setSavedData] = useState(initialData);
  const [draft, setDraft] = useState(initialData);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedData),
    [draft, savedData],
  );
  const location =
    savedData.locationLabel ||
    [savedData.city, savedData.state].filter(Boolean).join(", ");
  const storyReady = Boolean(
    savedData.shortDescription && savedData.description,
  );
  const seoReady = Boolean(savedData.seoTitle && savedData.seoDescription);

  const updateField = useCallback(
    (field: keyof ProjectDetailsDraft, value: string) => {
      setDraft((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const closeEditor = useCallback(() => {
    if (
      isDirty &&
      !window.confirm("Discard the unsaved project detail changes?")
    ) {
      return;
    }

    setDraft(savedData);
    setError(null);
    setIsOpen(false);
  }, [isDirty, savedData]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        closeEditor();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeEditor, isOpen, isSaving]);

  const saveDetails = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      try {
        setIsSaving(true);
        setError(null);

        const response = await fetch(
          `/api/admin/projects/${projectId}/details`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(draft),
          },
        );
        const data = (await response.json()) as ProjectDetailsResponse;

        if (!response.ok || !data.success || !data.project) {
          throw new Error(
            data.error || "The project details could not be saved.",
          );
        }

        const nextData = {
          ...draft,
          title: data.project.title,
          slug: data.project.slug,
        };

        setDraft(nextData);
        setSavedData(nextData);
        setIsOpen(false);
        router.refresh();
      } catch (saveError) {
        console.error("Unable to save project details:", saveError);
        setError(
          saveError instanceof Error
            ? saveError.message
            : "The project details could not be saved.",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [draft, projectId, router],
  );

  return (
    <>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">
              Step 01
            </p>
            <h2 className="mt-3 text-2xl font-normal text-white">
              Project details
            </h2>
            <p className="mt-1 text-sm text-white/35">
              Identity, story, property facts, credits, and search metadata.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setDraft(savedData);
              setError(null);
              setIsOpen(true);
            }}
            className="admin-btn-secondary"
          >
            Edit project details
          </button>
        </div>

        <dl className="grid gap-px bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Title", savedData.title],
            ["Location", location || "Not specified"],
            ["Project type", savedData.projectType || "Not specified"],
            ["Property type", savedData.propertyType || "Not specified"],
            ["Project story", storyReady ? "Complete" : "Needs content"],
            ["Search preview", seoReady ? "Customized" : "Uses defaults"],
            ["Status", statusLabel],
            ["Portfolio URL", `/portfolio/${savedData.slug}`],
            [
              "Property facts",
              savedData.squareFeet || savedData.bedrooms || savedData.bathrooms
                ? "Added"
                : "Not provided",
            ],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#0c0c0d] px-5 py-5 sm:px-6">
              <dt className="text-[0.58rem] font-semibold uppercase tracking-[0.17em] text-white/23">
                {label}
              </dt>
              <dd className="mt-2 truncate text-sm leading-6 text-white/62">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-details-title"
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/88 p-3 backdrop-blur-xl sm:p-6"
        >
          <div className="mx-auto my-3 max-w-6xl overflow-hidden rounded-3xl border border-white/[0.1] bg-[#101011] shadow-[0_40px_120px_rgba(0,0,0,0.75)] sm:my-8">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-5 border-b border-white/[0.08] bg-[#101011]/95 px-5 py-5 backdrop-blur-xl sm:px-7">
              <div>
                <p className="text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">
                  Project configuration
                </p>
                <h2
                  id="project-details-title"
                  className="mt-2 text-2xl font-normal text-white sm:text-3xl"
                >
                  Edit project details
                </h2>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                disabled={isSaving}
                aria-label="Close project details editor"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:border-white/25 hover:text-white disabled:opacity-35"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                >
                  <path
                    d="m6 6 12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={(event) => void saveDetails(event)}>
              <div className="space-y-5 p-4 sm:p-6">
                {error && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-red-300/15 bg-red-300/[0.06] px-5 py-4 text-sm text-red-200/80"
                  >
                    {error}
                  </div>
                )}

                <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
                  <SectionHeading
                    number="01"
                    title="Identity and location"
                    description="Control the public project name, URL, and geographic context."
                  />
                  <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                    <Field label="Project title">
                      <input
                        required
                        autoFocus
                        value={draft.title}
                        onChange={(event) =>
                          updateField("title", event.target.value)
                        }
                        maxLength={120}
                        className={inputClasses}
                      />
                    </Field>

                    <Field
                      label="Portfolio URL"
                      detail="Changing this updates the public project address."
                    >
                      <div className="mt-2 flex min-h-12 overflow-hidden rounded-xl border border-white/[0.08] bg-black/25 transition focus-within:border-[var(--helios-orange)]/45">
                        <span className="flex items-center border-r border-white/[0.08] px-3 text-xs text-white/22">
                          /portfolio/
                        </span>
                        <input
                          required
                          value={draft.slug}
                          onChange={(event) =>
                            updateField("slug", slugify(event.target.value))
                          }
                          maxLength={140}
                          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none"
                        />
                      </div>
                    </Field>

                    <Field label="City">
                      <input
                        value={draft.city}
                        onChange={(event) =>
                          updateField("city", event.target.value)
                        }
                        maxLength={120}
                        placeholder="Fort Collins"
                        className={inputClasses}
                      />
                    </Field>

                    <Field label="State">
                      <input
                        value={draft.state}
                        onChange={(event) =>
                          updateField("state", event.target.value)
                        }
                        maxLength={120}
                        placeholder="Colorado"
                        className={inputClasses}
                      />
                    </Field>

                    <Field
                      label="Display location"
                      className="sm:col-span-2"
                      detail="Optional. Replaces city and state in public experiences."
                    >
                      <input
                        value={draft.locationLabel}
                        onChange={(event) =>
                          updateField("locationLabel", event.target.value)
                        }
                        maxLength={180}
                        placeholder="Old Town Fort Collins, Colorado"
                        className={inputClasses}
                      />
                    </Field>
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
                  <SectionHeading
                    number="02"
                    title="Portfolio story"
                    description="Shape the concise preview and long-form public project narrative."
                  />
                  <div className="grid gap-5 p-5 sm:p-6">
                    <Field
                      label="Short description"
                      detail={`${draft.shortDescription.length}/320 characters · recommended, optional for video-led projects`}
                    >
                      <textarea
                        value={draft.shortDescription}
                        onChange={(event) =>
                          updateField("shortDescription", event.target.value)
                        }
                        maxLength={320}
                        rows={3}
                        placeholder="A concise introduction for portfolio previews."
                        className={`${inputClasses} resize-y py-3`}
                      />
                    </Field>

                    <Field
                      label="Project narrative"
                      detail={`${draft.description.length}/6000 characters`}
                    >
                      <textarea
                        value={draft.description}
                        onChange={(event) =>
                          updateField("description", event.target.value)
                        }
                        maxLength={6000}
                        rows={7}
                        placeholder="Tell the story of the property, creative approach, and final presentation."
                        className={`${inputClasses} resize-y py-3 leading-7`}
                      />
                    </Field>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Project type">
                        <input
                          value={draft.projectType}
                          onChange={(event) =>
                            updateField("projectType", event.target.value)
                          }
                          maxLength={120}
                          placeholder="Listing Media"
                          className={inputClasses}
                        />
                      </Field>

                      <Field label="Property type">
                        <input
                          value={draft.propertyType}
                          onChange={(event) =>
                            updateField("propertyType", event.target.value)
                          }
                          maxLength={120}
                          placeholder="Luxury Home"
                          className={inputClasses}
                        />
                      </Field>
                    </div>
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
                  <SectionHeading
                    number="03"
                    title="Property facts"
                    description="Add useful property context without coupling the portfolio to listing data."
                  />
                  <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
                    {[
                      ["Square feet", "squareFeet", "4200", "1"],
                      ["Bedrooms", "bedrooms", "4", "0.5"],
                      ["Bathrooms", "bathrooms", "3.5", "0.5"],
                    ].map(([label, field, placeholder, step]) => (
                      <Field key={field} label={label}>
                        <input
                          type="number"
                          min="0"
                          step={step}
                          value={draft[field as keyof ProjectDetailsDraft]}
                          onChange={(event) =>
                            updateField(
                              field as keyof ProjectDetailsDraft,
                              event.target.value,
                            )
                          }
                          placeholder={placeholder}
                          className={inputClasses}
                        />
                      </Field>
                    ))}

                    <Field label="Lot size">
                      <input
                        value={draft.lotSize}
                        onChange={(event) =>
                          updateField("lotSize", event.target.value)
                        }
                        maxLength={120}
                        placeholder="0.34 acres"
                        className={inputClasses}
                      />
                    </Field>

                    <Field label="Neighborhood">
                      <input
                        value={draft.neighborhood}
                        onChange={(event) =>
                          updateField("neighborhood", event.target.value)
                        }
                        maxLength={160}
                        placeholder="Old Town"
                        className={inputClasses}
                      />
                    </Field>

                    <Field
                      label="Property website"
                      className="sm:col-span-2 lg:col-span-3"
                    >
                      <input
                        type="url"
                        value={draft.propertyWebsiteUrl}
                        onChange={(event) =>
                          updateField("propertyWebsiteUrl", event.target.value)
                        }
                        maxLength={500}
                        placeholder="https://property.example.com"
                        className={inputClasses}
                      />
                    </Field>
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
                  <SectionHeading
                    number="04"
                    title="Project credits"
                    description="Recognize the people and teams behind the property and campaign."
                  />
                  <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
                    {[
                      ["Listing agent", "listingAgent"],
                      ["Brokerage", "brokerage"],
                      ["Builder", "builder"],
                      ["Architect", "architect"],
                      ["Interior designer", "interiorDesigner"],
                    ].map(([label, field]) => (
                      <Field key={field} label={label}>
                        <input
                          value={draft[field as keyof ProjectDetailsDraft]}
                          onChange={(event) =>
                            updateField(
                              field as keyof ProjectDetailsDraft,
                              event.target.value,
                            )
                          }
                          maxLength={160}
                          className={inputClasses}
                        />
                      </Field>
                    ))}
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
                  <SectionHeading
                    number="05"
                    title="Search and sharing"
                    description="Customize browser and social previews; blank fields use project defaults."
                  />
                  <div className="grid gap-5 p-5 sm:p-6">
                    <Field
                      label="SEO title"
                      detail={`${draft.seoTitle.length}/70 characters`}
                    >
                      <input
                        value={draft.seoTitle}
                        onChange={(event) =>
                          updateField("seoTitle", event.target.value)
                        }
                        maxLength={70}
                        placeholder={`${draft.title} | Helios Real Estate Media`}
                        className={inputClasses}
                      />
                    </Field>

                    <Field
                      label="SEO description"
                      detail={`${draft.seoDescription.length}/180 characters`}
                    >
                      <textarea
                        value={draft.seoDescription}
                        onChange={(event) =>
                          updateField("seoDescription", event.target.value)
                        }
                        maxLength={180}
                        rows={3}
                        placeholder={
                          draft.shortDescription ||
                          "A concise search and social description."
                        }
                        className={`${inputClasses} resize-y py-3`}
                      />
                    </Field>
                  </div>
                </section>
              </div>

              <div className="sticky bottom-0 flex flex-col gap-4 border-t border-white/[0.08] bg-[#101011]/95 px-5 py-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <p className="text-xs text-white/25">
                  {isDirty ? "Unsaved changes" : "All changes saved"}
                </p>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={isSaving}
                    className="admin-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isSaving || !isDirty || !draft.title || !draft.slug
                    }
                    className="admin-btn-primary"
                  >
                    {isSaving && (
                      <span className="h-3 w-3 animate-spin rounded-full border border-black/25 border-t-black" />
                    )}
                    {isSaving ? "Saving details" : "Save project"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
