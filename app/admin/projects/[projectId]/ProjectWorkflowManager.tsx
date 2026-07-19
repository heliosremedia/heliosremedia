"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

type ProjectStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type AssignableService = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  displayOrder: number;
};

type ProjectWorkflowManagerProps = {
  projectId: string;
  projectSlug: string;
  initialStatus: ProjectStatus;
  initialFeatured: boolean;
  initialPublishedAt: string | null;
  heroMediaId: string | null;
  visibleMediaCount: number;
  hasProjectSummary: boolean;
  hasPlayableVideo: boolean;
  services: AssignableService[];
  initialServiceIds: string[];
};

type WorkflowResponse = {
  success: boolean;
  error?: string;
  blockers?: string[];
  serviceIds?: string[];
  project?: {
    status: ProjectStatus;
    featured: boolean;
    publishedAt: string | null;
  };
};

function formatStatus(status: ProjectStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function statusClasses(status: ProjectStatus) {
  switch (status) {
    case "PUBLISHED":
      return "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200";
    case "ARCHIVED":
      return "border-white/10 bg-white/[0.04] text-white/45";
    default:
      return "border-amber-300/20 bg-amber-300/[0.07] text-amber-200";
  }
}

export default function ProjectWorkflowManager({
  projectId,
  projectSlug,
  initialStatus,
  initialFeatured,
  initialPublishedAt,
  heroMediaId,
  visibleMediaCount,
  hasProjectSummary,
  hasPlayableVideo,
  services,
  initialServiceIds,
}: ProjectWorkflowManagerProps) {
  const [selectedServiceIds, setSelectedServiceIds] = useState(
    new Set(initialServiceIds),
  );
  const [savedServiceIds, setSavedServiceIds] = useState(
    new Set(initialServiceIds),
  );
  const [status, setStatus] = useState(initialStatus);
  const [featured, setFeatured] = useState(initialFeatured);
  const [publishedAt, setPublishedAt] = useState(initialPublishedAt);
  const [isSavingServices, setIsSavingServices] = useState(false);
  const [workflowAction, setWorkflowAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverBlockers, setServerBlockers] = useState<string[]>([]);

  const serviceSelectionChanged = useMemo(() => {
    if (selectedServiceIds.size !== savedServiceIds.size) {
      return true;
    }

    return [...selectedServiceIds].some(
      (serviceId) => !savedServiceIds.has(serviceId),
    );
  }, [savedServiceIds, selectedServiceIds]);

  const activeSavedServiceCount = useMemo(
    () =>
      services.filter(
        (service) => service.active && savedServiceIds.has(service.id),
      ).length,
    [savedServiceIds, services],
  );

  const publishingRequirements = useMemo(
    () => [
      {
        label: "Project introduction ready",
        complete: hasProjectSummary || hasPlayableVideo,
        detail: hasProjectSummary
          ? "The public project has a concise introduction."
          : hasPlayableVideo
            ? "The project can lead directly with its featured video."
            : "Add a short description in project details.",
      },
      {
        label: "Lead media ready",
        complete: Boolean(heroMediaId) || hasPlayableVideo,
        detail: heroMediaId
          ? "The public project has a lead visual."
          : hasPlayableVideo
            ? "A playable video will lead this project."
            : "Select a hero image or add a playable video.",
      },
      {
        label: "Visible media available",
        complete: visibleMediaCount > 0,
        detail:
          visibleMediaCount > 0
            ? `${visibleMediaCount} visible ${
                visibleMediaCount === 1 ? "asset is" : "assets are"
              } ready.`
            : "At least one visible media asset is required.",
      },
      {
        label: "Services assigned",
        complete: activeSavedServiceCount > 0,
        detail:
          activeSavedServiceCount > 0
            ? `${activeSavedServiceCount} ${
                activeSavedServiceCount === 1 ? "service is" : "services are"
              } connected.`
            : "Assign and save at least one active service.",
      },
    ],
    [
      activeSavedServiceCount,
      hasProjectSummary,
      hasPlayableVideo,
      heroMediaId,
      visibleMediaCount,
    ],
  );

  const canPublish = publishingRequirements.every(
    (requirement) => requirement.complete,
  );

  const updateProjectFromResponse = useCallback((data: WorkflowResponse) => {
    if (!data.project) {
      return;
    }

    setStatus(data.project.status);
    setFeatured(data.project.featured);
    setPublishedAt(data.project.publishedAt);
  }, []);

  const saveServices = useCallback(async () => {
    try {
      setIsSavingServices(true);
      setError(null);
      setServerBlockers([]);

      const serviceIds = [...selectedServiceIds];
      const response = await fetch(
        `/api/admin/projects/${projectId}/workflow`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "assign-services",
            serviceIds,
          }),
        },
      );
      const data = (await response.json()) as WorkflowResponse;

      if (!response.ok || !data.success || !data.serviceIds) {
        throw new Error(
          data.error || "The service selection could not be saved.",
        );
      }

      setSelectedServiceIds(new Set(data.serviceIds));
      setSavedServiceIds(new Set(data.serviceIds));
    } catch (saveError) {
      console.error("Unable to save project services:", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The service selection could not be saved.",
      );
    } finally {
      setIsSavingServices(false);
    }
  }, [projectId, selectedServiceIds]);

  const runWorkflowAction = useCallback(
    async (action: "publish" | "unpublish" | "archive" | "set-featured") => {
      try {
        setWorkflowAction(action);
        setError(null);
        setServerBlockers([]);

        const response = await fetch(
          `/api/admin/projects/${projectId}/workflow`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action,
              ...(action === "set-featured"
                ? {
                    featured: !featured,
                  }
                : {}),
            }),
          },
        );
        const data = (await response.json()) as WorkflowResponse;

        if (!response.ok || !data.success || !data.project) {
          setServerBlockers(data.blockers || []);
          throw new Error(
            data.error || "The project status could not be saved.",
          );
        }

        updateProjectFromResponse(data);
      } catch (workflowError) {
        console.error("Unable to update project workflow:", workflowError);
        setError(
          workflowError instanceof Error
            ? workflowError.message
            : "The project status could not be saved.",
        );
      } finally {
        setWorkflowAction(null);
      }
    },
    [featured, projectId, updateProjectFromResponse],
  );

  return (
    <div className="space-y-8">
      {error && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-300/15 bg-red-300/[0.05] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-red-200/80">{error}</p>

            {serverBlockers.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs leading-5 text-red-200/55">
                {serverBlockers.map((blocker) => (
                  <li key={blocker}>• {blocker}</li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setServerBlockers([]);
            }}
            className="self-start text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-red-200/60 transition hover:text-red-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <section
        id="project-services"
        className="scroll-mt-8 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]"
      >
        <div className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.19em] text-[var(--helios-orange)]">
              Step 03
            </p>

            <h2 className="mt-3 text-2xl font-normal text-white sm:text-3xl">
              Project services
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/35">
              Select the services represented in this project. These become
              public portfolio labels and filtering signals.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-white/25">
              {selectedServiceIds.size} selected
            </span>

            <button
              type="button"
              onClick={() => void saveServices()}
              disabled={isSavingServices || !serviceSelectionChanged}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--helios-orange)] px-6 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-black transition hover:bg-[var(--helios-orange-hover)] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {isSavingServices && (
                <span className="h-3 w-3 animate-spin rounded-full border border-black/25 border-t-black" />
              )}
              {isSavingServices ? "Saving" : "Save services"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
          {services.map((service) => {
            const selected = selectedServiceIds.has(service.id);
            const unavailable =
              !service.active && !savedServiceIds.has(service.id);

            return (
              <button
                key={service.id}
                type="button"
                disabled={unavailable || isSavingServices}
                onClick={() =>
                  setSelectedServiceIds((current) => {
                    const next = new Set(current);

                    if (next.has(service.id)) {
                      next.delete(service.id);
                    } else {
                      next.add(service.id);
                    }

                    return next;
                  })
                }
                aria-pressed={selected}
                className={`min-h-36 rounded-2xl border p-5 text-left transition ${
                  selected
                    ? "border-[var(--helios-orange)]/50 bg-[var(--helios-orange)]/[0.08] shadow-[0_15px_40px_rgba(217,107,43,0.06)]"
                    : "border-white/[0.08] bg-black/20 hover:border-white/20 hover:bg-white/[0.025]"
                } disabled:cursor-not-allowed disabled:opacity-35`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/25">
                      Service
                    </p>

                    <h3 className="mt-2 text-lg font-normal text-white">
                      {service.name}
                    </h3>
                  </div>

                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
                      selected
                        ? "border-[var(--helios-orange)] bg-[var(--helios-orange)] text-black"
                        : "border-white/15 text-transparent"
                    }`}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-3.5 w-3.5"
                    >
                      <path
                        d="m7 12.5 3.1 3L17.5 8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>

                <p className="mt-3 text-xs leading-5 text-white/35">
                  {service.description || "No description added."}
                </p>

                {!service.active && (
                  <p className="mt-3 text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-amber-200/55">
                    Inactive service
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section
        id="project-publishing"
        className="scroll-mt-8 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]"
      >
        <div className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.19em] text-[var(--helios-orange)]">
              Step 04
            </p>

            <h2 className="mt-3 text-2xl font-normal text-white sm:text-3xl">
              Review and publish
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/35">
              Validate the public project, control its website status, and
              decide whether it should receive featured placement.
            </p>
          </div>

          <span
            className={`self-start rounded-full border px-4 py-2 text-[0.58rem] font-semibold uppercase tracking-[0.15em] sm:self-auto ${statusClasses(
              status,
            )}`}
          >
            {formatStatus(status)}
          </span>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_22rem] sm:p-6">
          <div className="space-y-3">
            {publishingRequirements.map((requirement) => (
              <div
                key={requirement.label}
                className="flex items-start gap-4 rounded-2xl border border-white/[0.08] bg-black/20 p-4"
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                    requirement.complete
                      ? "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200"
                      : "border-amber-300/20 bg-amber-300/[0.06] text-amber-200/60"
                  }`}
                >
                  {requirement.complete ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-3.5 w-3.5"
                    >
                      <path
                        d="m7 12.5 3.1 3L17.5 8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </span>

                <div>
                  <p className="text-sm font-medium text-white/75">
                    {requirement.label}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-white/30">
                    {requirement.detail}
                  </p>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-white/75">
                    Featured project
                  </p>

                  <p className="mt-1 text-xs leading-5 text-white/30">
                    Prioritize this project in premium portfolio placements.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void runWorkflowAction("set-featured")}
                  disabled={workflowAction !== null || status !== "PUBLISHED"}
                  aria-pressed={featured}
                  className={`relative h-7 w-13 rounded-full border transition ${
                    featured
                      ? "border-[var(--helios-orange)] bg-[var(--helios-orange)]"
                      : "border-white/15 bg-white/[0.05]"
                  } disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  <span
                    className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition ${
                      featured ? "left-7" : "left-1"
                    }`}
                  />
                  <span className="sr-only">
                    {featured ? "Remove featured status" : "Feature project"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 lg:self-start">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">
              Publishing controls
            </p>

            <h3 className="mt-3 text-2xl font-normal text-white">
              {status === "PUBLISHED"
                ? "Project is live"
                : canPublish
                  ? "Ready to publish"
                  : "Complete requirements"}
            </h3>

            <p className="mt-3 text-sm leading-6 text-white/40">
              {status === "PUBLISHED"
                ? `Published${
                    publishedAt
                      ? ` ${new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }).format(new Date(publishedAt))}`
                      : ""
                  }.`
                : "Publishing makes this project available to the public portfolio."}
            </p>

            <div className="mt-6 space-y-3">
              {status === "PUBLISHED" ? (
                <>
                  <Link
                    href={`/portfolio/${projectSlug}`}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--helios-orange)] px-5 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-black transition hover:bg-[var(--helios-orange-hover)]"
                  >
                    View live project
                  </Link>

                  <button
                    type="button"
                    onClick={() => void runWorkflowAction("unpublish")}
                    disabled={workflowAction !== null}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/10 px-5 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-white/45 transition hover:border-white/25 hover:text-white disabled:cursor-wait disabled:opacity-40"
                  >
                    {workflowAction === "unpublish"
                      ? "Moving to draft"
                      : "Move to draft"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void runWorkflowAction("publish")}
                  disabled={workflowAction !== null || !canPublish}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--helios-orange)] px-5 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-black transition hover:bg-[var(--helios-orange-hover)] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {workflowAction === "publish" && (
                    <span className="h-3 w-3 animate-spin rounded-full border border-black/25 border-t-black" />
                  )}
                  {workflowAction === "publish"
                    ? "Publishing"
                    : "Publish project"}
                </button>
              )}

              {status !== "ARCHIVED" && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Archive this project? It will be removed from the public portfolio.",
                      )
                    ) {
                      void runWorkflowAction("archive");
                    }
                  }}
                  disabled={workflowAction !== null}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-red-300/10 px-5 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-red-200/45 transition hover:border-red-300/25 hover:text-red-100 disabled:cursor-wait disabled:opacity-40"
                >
                  {workflowAction === "archive"
                    ? "Archiving"
                    : "Archive project"}
                </button>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
