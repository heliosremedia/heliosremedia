"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import ProjectSectionLink from "./ProjectSectionLink";
import ProjectEditorSection from "./ProjectEditorSection";

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
  initialUpdatedAt: string;
  projectSlug: string;
  initialStatus: ProjectStatus;
  initialFeatured: boolean;
  initialFeaturedStartedAt: string | null;
  initialFeaturedExpiresAt: string | null;
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
  updatedAt?: string;
  reloadRequired?: boolean;
  project?: {
    status: ProjectStatus;
    featured: boolean;
    featuredStartedAt: string | null;
    featuredExpiresAt: string | null;
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

function revealSection(id: string) {
  const section = document.getElementById(id);
  const toggle = section?.querySelector<HTMLButtonElement>("button[aria-expanded]");
  if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
  requestAnimationFrame(() => section?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

export default function ProjectWorkflowManager({
  projectId,
  initialUpdatedAt,
  projectSlug,
  initialStatus,
  initialFeatured,
  initialFeaturedStartedAt,
  initialFeaturedExpiresAt,
  initialPublishedAt,
  heroMediaId,
  visibleMediaCount,
  hasProjectSummary,
  hasPlayableVideo,
  services,
  initialServiceIds,
}: ProjectWorkflowManagerProps) {
  const router = useRouter();
  const [serviceRevision, setServiceRevision] = useState(initialUpdatedAt);
  const serviceSaveRef = useRef(false);
  const serviceReviewRef = useRef(false);
  const [serviceReviewRequired, setServiceReviewRequired] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [serviceSaved, setServiceSaved] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState(
    new Set(initialServiceIds),
  );
  const [savedServiceIds, setSavedServiceIds] = useState(
    new Set(initialServiceIds),
  );
  const [status, setStatus] = useState(initialStatus);
  const [featured, setFeatured] = useState(initialFeatured);
  const [featuredStartedAt, setFeaturedStartedAt] = useState(initialFeaturedStartedAt);
  const [featuredExpiresAt, setFeaturedExpiresAt] = useState(initialFeaturedExpiresAt);
  const [featuredTimeReference] = useState(() => Date.now());
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
        href: "#project-identity" as const,
        action: "Edit project details",
        complete: hasProjectSummary || hasPlayableVideo,
        detail: hasProjectSummary
          ? "The public project has a concise introduction."
          : hasPlayableVideo
            ? "The project can lead directly with its featured video."
            : "Add a short description in project details.",
      },
      {
        label: "Lead media ready",
        href: "#project-media" as const,
        action: "Choose lead media",
        complete: Boolean(heroMediaId) || hasPlayableVideo,
        detail: heroMediaId
          ? "The public project has a lead visual."
          : hasPlayableVideo
            ? "A playable video will lead this project."
            : "Select a hero image or add a playable video.",
      },
      {
        label: "Visible media available",
        href: "#project-media" as const,
        action: "Manage project media",
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
        href: "#project-services" as const,
        action: "Choose project services",
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
    setFeaturedStartedAt(data.project.featuredStartedAt);
    setFeaturedExpiresAt(data.project.featuredExpiresAt);
    setPublishedAt(data.project.publishedAt);
  }, []);

  const saveServices = useCallback(async () => {
    if (serviceSaveRef.current || serviceReviewRef.current || workflowAction) return;
    serviceSaveRef.current = true;
    setIsSavingServices(true);
    setServiceError(null);
    setServiceSaved(false);
    let confirmedRejection = false;
    try {
      const serviceIds = [...selectedServiceIds];
      const response = await fetch(`/api/admin/projects/${projectId}/workflow`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign-services", serviceIds, expectedUpdatedAt: serviceRevision, expectedServiceIds: [...savedServiceIds] }),
      });
      const data = await response.json() as WorkflowResponse;
      if (!response.ok || !data.success) {
        confirmedRejection = response.status === 400 && data.success === false && !data.reloadRequired;
        throw new Error(data.error || "The service selection could not be saved.");
      }
      if (!Array.isArray(data.serviceIds) || data.serviceIds.length !== serviceIds.length || new Set(data.serviceIds).size !== serviceIds.length || !data.serviceIds.every(id => serviceIds.includes(id)) || !data.updatedAt || !Number.isFinite(Date.parse(data.updatedAt)) || new Date(data.updatedAt).toISOString() !== data.updatedAt || Date.parse(data.updatedAt) <= Date.parse(serviceRevision)) {
        throw new Error("The service save receipt could not be confirmed.");
      }
      setSavedServiceIds(new Set(data.serviceIds));
      setServiceRevision(data.updatedAt);
      setServiceSaved(true);
      router.refresh();
    } catch (saveError) {
      if (!confirmedRejection) { serviceReviewRef.current = true; setServiceReviewRequired(true); }
      revealSection("project-services");
      setServiceError(confirmedRejection && saveError instanceof Error ? saveError.message : "The saved selection needs review. Your selections remain here; reload the saved project before trying again.");
    } finally { serviceSaveRef.current = false; setIsSavingServices(false); }
  }, [projectId, router, selectedServiceIds, savedServiceIds, serviceRevision, workflowAction]);

  const runWorkflowAction = useCallback(
    async (action: "publish" | "unpublish" | "archive" | "set-featured", featuredDuration?: string) => {
      if (serviceSaveRef.current || serviceReviewRef.current || serviceSelectionChanged) return;
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
                    featuredDuration: featuredDuration || (featured ? "NONE" : "ALWAYS"),
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
        router.refresh();
      } catch (workflowError) {
        revealSection("project-publishing");
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
    [featured, projectId, router, updateProjectFromResponse, serviceSelectionChanged],
  );

  return (
    <div className="space-y-8">
      {error && (
        <div role="alert" tabIndex={-1} className="flex flex-col gap-3 rounded-2xl border border-red-300/15 bg-red-300/[0.05] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
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
            className="self-start admin-btn-link-destructive"
          >
            Dismiss
          </button>
        </div>
      )}

      <ProjectEditorSection id="project-services" eyebrow="Step 03" title="Services and SEO" summary="Choose the services represented by this project and manage its public portfolio signals." status={
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs text-white/65">
              {selectedServiceIds.size} selected
            </span>

            <button
              type="button"
              onClick={() => void saveServices()}
              disabled={isSavingServices || serviceReviewRequired || workflowAction !== null || !serviceSelectionChanged}
              className="admin-btn-primary"
            >
              {isSavingServices && (
                <span className="h-3 w-3 animate-spin rounded-full border border-black/25 border-t-black" />
              )}
              {isSavingServices ? "Saving" : "Save services"}
            </button>
          </div>
      }>

        {serviceError && <div role="alert" className="mb-4 rounded-xl border border-amber-200/30 p-4 text-sm text-amber-100">
          <p>{serviceError}</p>
          {serviceReviewRequired && <button type="button" className="mt-3 underline" onClick={() => { if (window.confirm("Reload the saved project and discard these local service selections? Note any selections you need first.")) window.location.reload(); }}>Reload saved project</button>}
        </div>}
        {serviceSaved && <p role="status" className="mb-4 text-sm text-emerald-200">Services saved.</p>}
        {serviceSelectionChanged && <p className="mb-4 text-sm text-white/65">Unsaved service selection. Save before reviewing publication.</p>}
        {services.length === 0 && <p className="text-sm text-white/65">No services are available in this workspace. <Link href="/admin/services" className="underline">Manage workspace services</Link></p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const selected = selectedServiceIds.has(service.id);
            const unavailable =
              !service.active && !savedServiceIds.has(service.id);

            return (
              <button
                key={service.id}
                type="button"
                disabled={unavailable || isSavingServices || serviceReviewRequired || workflowAction !== null}
                onClick={() => {
                  if (serviceSaveRef.current || serviceReviewRef.current) return;
                  // A new edit can use refreshed details only while its saved service
                  // selection is unchanged. Never rebase an in-progress selection.
                  if (!serviceSelectionChanged && Date.parse(initialUpdatedAt) > Date.parse(serviceRevision)
                    && initialServiceIds.length === savedServiceIds.size
                    && initialServiceIds.every(id => savedServiceIds.has(id))) {
                    setServiceRevision(initialUpdatedAt);
                  }
                  setServiceSaved(false);
                  setSelectedServiceIds((current) => {
                    if (serviceSaveRef.current || serviceReviewRef.current) return current;
                    const next = new Set(current);

                    if (next.has(service.id)) {
                      next.delete(service.id);
                    } else {
                      next.add(service.id);
                    }

                    return next;
                  });
                }}
                aria-pressed={selected}
                className={`min-w-0 break-words min-h-36 rounded-2xl border p-5 text-left transition ${
                  selected
                    ? "border-[var(--helios-orange)]/50 bg-[var(--helios-orange)]/[0.08] shadow-[0_15px_40px_rgba(217,107,43,0.06)]"
                    : "border-white/[0.08] bg-black/20 hover:border-white/20 hover:bg-white/[0.025]"
                } disabled:cursor-not-allowed ${unavailable ? "disabled:opacity-50" : "disabled:opacity-100"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/65">
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

                <p className="mt-3 text-xs leading-5 text-white/65">
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
      </ProjectEditorSection>

      <ProjectEditorSection id="project-publishing" eyebrow="Step 04" title="Review and Publish" summary="Validate the public project, control its website status, and decide whether it receives featured placement." status={<span
            className={`self-start rounded-full border px-4 py-2 text-[0.58rem] font-semibold uppercase tracking-[0.15em] sm:self-auto ${statusClasses(
              status,
            )}`}
          >
            {formatStatus(status)}
          </span>}>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-3">
            {publishingRequirements.map((requirement) => (
              <div
                key={requirement.label}
                className={`flex items-start gap-4 rounded-2xl border p-4 ${requirement.complete ? "border-emerald-300/15 bg-emerald-300/[0.035]" : "border-white/[0.08] bg-black/20"}`}
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

                  <p className="mt-1 text-xs leading-5 text-white/65">
                    {requirement.detail}
                  </p>
                  {!requirement.complete && <ProjectSectionLink href={requirement.href} className="mt-2 inline-block text-sm underline">{requirement.action}</ProjectSectionLink>}
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-white/75">
                    Featured project
                  </p>

                  <p className="mt-1 text-xs leading-5 text-white/65">
                    Prioritize this project in premium portfolio placements.
                  </p>
                </div>

                <select
                  aria-label="Featured project duration"
                  value={!featured ? "NONE" : featuredExpiresAt ? "TIMED" : "ALWAYS"}
                  onChange={(event) => event.target.value !== "TIMED" && void runWorkflowAction("set-featured", event.target.value)}
                  disabled={isSavingServices || serviceReviewRequired || serviceSelectionChanged || workflowAction !== null || status !== "PUBLISHED"}
                  className="min-h-11 rounded-xl border border-white/10 bg-[#111] px-4 text-sm text-white disabled:opacity-35"
                >
                  <option value="NONE">Not Featured</option>
                  <option value="7_DAYS">7 days</option>
                  <option value="14_DAYS">14 days</option>
                  <option value="30_DAYS">30 days</option>
                  {featuredExpiresAt ? <option value="TIMED" disabled>Current timed placement</option> : null}
                  <option value="ALWAYS">Always</option>
                </select>
              </div>
              {featured ? <p className="mt-4 text-xs text-white/40">
                Started {featuredStartedAt ? new Date(featuredStartedAt).toLocaleString("en-US", { timeZone: "America/Denver", timeZoneName: "short" }) : "before timing records"}
                {" · "}
                {featuredExpiresAt
                  ? `Expires ${new Date(featuredExpiresAt).toLocaleString("en-US", { timeZone: "America/Denver", timeZoneName: "short" })} · ${Math.max(0, Math.ceil((new Date(featuredExpiresAt).getTime() - featuredTimeReference) / 86_400_000))} days remaining`
                  : "Always featured"}
              </p> : null}
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

            <div className="mt-5 rounded-xl border border-white/15 p-4">
              <p className="text-sm text-white/75">Review this draft before making it public.</p>
              <ProjectSectionLink href="#project-previews" className="mt-2 inline-block text-sm underline">Review privately</ProjectSectionLink>
            </div>
            <div className="mt-5">
              {status === "PUBLISHED" ? (
                <div className="space-y-3">
                  <Link
                    href={`/portfolio/${projectSlug}`}
                    className="!w-full admin-btn-primary"
                  >
                    View live project
                  </Link>

                  <button
                    type="button"
                    onClick={() => void runWorkflowAction("unpublish")}
                    disabled={isSavingServices || serviceReviewRequired || serviceSelectionChanged || workflowAction !== null}
                    className="!w-full admin-btn-secondary"
                  >
                    {workflowAction === "unpublish"
                      ? "Moving to draft"
                      : "Move to draft"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void runWorkflowAction("publish")}
                  disabled={isSavingServices || serviceReviewRequired || serviceSelectionChanged || workflowAction !== null || !canPublish}
                  className="!w-full admin-btn-primary"
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
                <div className="mt-5 border-t border-white/[0.08] pt-5">
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
                    disabled={isSavingServices || serviceReviewRequired || serviceSelectionChanged || workflowAction !== null}
                    className="!w-full admin-btn-destructive"
                  >
                    {workflowAction === "archive"
                      ? "Archiving"
                      : "Archive project"}
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </ProjectEditorSection>
    </div>
  );
}
