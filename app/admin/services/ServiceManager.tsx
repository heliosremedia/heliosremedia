"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type AdminService = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    projects: number;
  };
};

type ServiceManagerProps = {
  initialServices: AdminService[];
};

type ServiceMutationResponse = {
  success: boolean;
  error?: string;
  service?: AdminService;
  serviceIds?: string[];
};

type ServiceDraft = {
  name: string;
  slug: string;
  description: string;
};

type SortableServiceCardProps = {
  service: AdminService;
  position: number;
  disabled: boolean;
  onEdit: (service: AdminService) => void;
  onToggleActive: (service: AdminService) => void;
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function SortableServiceCard({
  service,
  position,
  disabled,
  onEdit,
  onToggleActive,
}: SortableServiceCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: service.id,
    disabled,
  });

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      className={`relative grid gap-5 rounded-2xl border px-5 py-5 transition sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-6 ${
        isDragging
          ? "border-[var(--helios-orange)]/60 bg-[#17120f] opacity-80 shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
          : service.active
            ? "border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16]"
            : "border-white/[0.06] bg-black/20 opacity-65"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          className="flex h-10 w-10 touch-none items-center justify-center rounded-full border border-white/10 text-white/35 transition hover:border-[var(--helios-orange)]/40 hover:bg-[var(--helios-orange)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)] disabled:cursor-wait disabled:opacity-40"
          aria-label={`Reorder ${service.name}, currently position ${position}`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
          >
            <circle cx="8" cy="7" r="1.25" fill="currentColor" />
            <circle cx="16" cy="7" r="1.25" fill="currentColor" />
            <circle cx="8" cy="12" r="1.25" fill="currentColor" />
            <circle cx="16" cy="12" r="1.25" fill="currentColor" />
            <circle cx="8" cy="17" r="1.25" fill="currentColor" />
            <circle cx="16" cy="17" r="1.25" fill="currentColor" />
          </svg>
        </button>

        <span className="flex h-9 min-w-9 items-center justify-center rounded-full border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.06] px-2 text-[0.56rem] font-semibold tracking-[0.14em] text-[var(--helios-orange)]">
          {String(position).padStart(2, "0")}
        </span>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-xl font-normal text-white">{service.name}</h2>

          <span
            className={`rounded-full border px-2.5 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.14em] ${
              service.active
                ? "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200/70"
                : "border-white/10 bg-white/[0.03] text-white/30"
            }`}
          >
            {service.active ? "Active" : "Inactive"}
          </span>
        </div>

        <p className="mt-1.5 text-xs text-white/25">/{service.slug}</p>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
          {service.description || "No service description has been added."}
        </p>

        <p className="mt-3 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-white/25">
          {service._count.projects}{" "}
          {service._count.projects === 1 ? "project" : "projects"}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() => onToggleActive(service)}
          disabled={disabled}
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 px-4 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-white/40 transition hover:border-white/25 hover:text-white disabled:cursor-wait disabled:opacity-40"
        >
          {service.active ? "Deactivate" : "Activate"}
        </button>

        <button
          type="button"
          onClick={() => onEdit(service)}
          disabled={disabled}
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--helios-orange)] px-4 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-[var(--helios-orange-hover)] disabled:cursor-wait disabled:opacity-40"
        >
          Edit
        </button>
      </div>
    </article>
  );
}

export default function ServiceManager({
  initialServices,
}: ServiceManagerProps) {
  const [services, setServices] = useState(
    [...initialServices].sort(
      (first, second) => first.displayOrder - second.displayOrder,
    ),
  );
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServiceDraft | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [updatingServiceId, setUpdatingServiceId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeCount = useMemo(
    () => services.filter((service) => service.active).length,
    [services],
  );

  const openCreateModal = useCallback(() => {
    setEditingServiceId(null);
    setDraft({
      name: "",
      slug: "",
      description: "",
    });
    setSlugEdited(false);
    setError(null);
  }, []);

  const openEditModal = useCallback((service: AdminService) => {
    setEditingServiceId(service.id);
    setDraft({
      name: service.name,
      slug: service.slug,
      description: service.description || "",
    });
    setSlugEdited(true);
    setError(null);
  }, []);

  const closeModal = useCallback(() => {
    if (isSaving) {
      return;
    }

    setEditingServiceId(null);
    setDraft(null);
    setError(null);
  }, [isSaving]);

  useEffect(() => {
    if (!draft) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeModal, draft]);

  const saveService = useCallback(async () => {
    if (!draft || !draft.name.trim()) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const isEditing = editingServiceId !== null;
      const response = await fetch("/api/admin/services", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(isEditing
            ? {
                action: "update",
                serviceId: editingServiceId,
              }
            : {}),
          name: draft.name,
          slug: draft.slug,
          description: draft.description,
        }),
      });
      const data = (await response.json()) as ServiceMutationResponse;

      if (!response.ok || !data.success || !data.service) {
        throw new Error(data.error || "The service could not be saved.");
      }

      const savedService = data.service;

      setServices((currentServices) => {
        const exists = currentServices.some(
          (service) => service.id === savedService.id,
        );

        if (!exists) {
          return [...currentServices, savedService].sort(
            (first, second) => first.displayOrder - second.displayOrder,
          );
        }

        return currentServices.map((service) =>
          service.id === savedService.id ? savedService : service,
        );
      });
      setEditingServiceId(null);
      setDraft(null);
    } catch (saveError) {
      console.error("Unable to save service:", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The service could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }, [draft, editingServiceId]);

  const toggleServiceActive = useCallback(async (service: AdminService) => {
    try {
      setUpdatingServiceId(service.id);
      setError(null);

      const response = await fetch("/api/admin/services", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "set-active",
          serviceId: service.id,
          active: !service.active,
        }),
      });
      const data = (await response.json()) as ServiceMutationResponse;

      if (!response.ok || !data.success || !data.service) {
        throw new Error(data.error || "The service status could not be saved.");
      }

      const updatedService = data.service;

      setServices((currentServices) =>
        currentServices.map((currentService) =>
          currentService.id === updatedService.id
            ? updatedService
            : currentService,
        ),
      );
    } catch (updateError) {
      console.error("Unable to update service status:", updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "The service status could not be saved.",
      );
    } finally {
      setUpdatingServiceId(null);
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id || isReordering) {
        return;
      }

      const previousServices = services;
      const oldIndex = previousServices.findIndex(
        (service) => service.id === active.id,
      );
      const newIndex = previousServices.findIndex(
        (service) => service.id === over.id,
      );

      if (oldIndex < 0 || newIndex < 0) {
        return;
      }

      const reorderedServices = arrayMove(
        previousServices,
        oldIndex,
        newIndex,
      ).map((service, index) => ({
        ...service,
        displayOrder: index,
      }));

      setServices(reorderedServices);
      setIsReordering(true);
      setError(null);

      try {
        const serviceIds = reorderedServices.map((service) => service.id);
        const response = await fetch("/api/admin/services", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "reorder",
            serviceIds,
          }),
        });
        const data = (await response.json()) as ServiceMutationResponse;

        if (!response.ok || !data.success || !data.serviceIds) {
          throw new Error(
            data.error || "The service order could not be saved.",
          );
        }

        if (
          data.serviceIds.length !== serviceIds.length ||
          data.serviceIds.some(
            (serviceId, index) => serviceId !== serviceIds[index],
          )
        ) {
          throw new Error("The saved service order did not match the request.");
        }
      } catch (reorderError) {
        console.error("Unable to reorder services:", reorderError);
        setServices(previousServices);
        setError(
          reorderError instanceof Error
            ? reorderError.message
            : "The service order could not be saved.",
        );
      } finally {
        setIsReordering(false);
      }
    },
    [isReordering, services],
  );

  return (
    <>
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ["Total services", services.length, "Portfolio taxonomy"],
            ["Active services", activeCount, "Available for assignment"],
            [
              "Project uses",
              services.reduce(
                (total, service) => total + service._count.projects,
                0,
              ),
              "Assignments across projects",
            ],
          ].map(([label, value, detail]) => (
            <article
              key={label as string}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"
            >
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.19em] text-white/30">
                {label}
              </p>

              <div className="mt-4 flex items-end justify-between gap-4">
                <p className="font-display text-4xl font-light leading-none text-white">
                  {value}
                </p>

                <p className="max-w-32 text-right text-[0.65rem] leading-5 text-white/25">
                  {detail}
                </p>
              </div>
            </article>
          ))}
        </section>

        {error && !draft && (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-300/15 bg-red-300/[0.05] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-red-200/80">{error}</p>

            <button
              type="button"
              onClick={() => setError(null)}
              className="self-start text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-red-200/60 transition hover:text-red-100 sm:self-auto"
            >
              Dismiss
            </button>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">
                Service registry
              </p>

              <h2 className="mt-2 text-2xl font-normal text-white">
                Portfolio services
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/35">
                Drag to control public display order. Inactive services remain
                attached to existing projects but cannot be assigned to new
                work.
              </p>
            </div>

            <div className="flex items-center gap-4">
              {isReordering && (
                <span
                  role="status"
                  className="inline-flex items-center gap-2 text-[0.56rem] font-semibold uppercase tracking-[0.15em] text-[var(--helios-orange)]/80"
                >
                  <span className="h-3 w-3 animate-spin rounded-full border border-[var(--helios-orange)]/25 border-t-[var(--helios-orange)]" />
                  Saving order
                </span>
              )}

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--helios-orange)] px-6 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-black transition hover:bg-[var(--helios-orange-hover)]"
              >
                Add service
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {services.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => void handleDragEnd(event)}
              >
                <SortableContext
                  items={services.map((service) => service.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {services.map((service, index) => (
                      <SortableServiceCard
                        key={service.id}
                        service={service}
                        position={index + 1}
                        disabled={isReordering || updatingServiceId !== null}
                        onEdit={openEditModal}
                        onToggleActive={(selectedService) =>
                          void toggleServiceActive(selectedService)
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-6 py-14 text-center">
                <h3 className="text-xl font-normal text-white">
                  No services configured
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/35">
                  Add the first service to begin building the reusable portfolio
                  taxonomy.
                </p>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--helios-orange)] px-6 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-black transition hover:bg-[var(--helios-orange-hover)]"
                >
                  Add first service
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {draft && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-editor-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 px-4 py-8 backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={closeModal}
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Close service editor"
          />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveService();
            }}
            className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/10 bg-[#111111] shadow-[0_40px_120px_rgba(0,0,0,0.75)]"
          >
            <div className="flex items-start justify-between gap-6 border-b border-white/[0.08] px-6 py-6 sm:px-8">
              <div>
                <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">
                  Service registry
                </p>

                <h3
                  id="service-editor-title"
                  className="mt-3 text-2xl font-normal text-white sm:text-3xl"
                >
                  {editingServiceId ? "Edit service" : "Create service"}
                </h3>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/45 transition hover:border-white/25 hover:bg-white/[0.05] hover:text-white disabled:cursor-wait disabled:opacity-40"
                aria-label="Close service editor"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                >
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-6 px-6 py-7 sm:px-8">
              <label className="block">
                <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Service name
                </span>

                <input
                  autoFocus
                  required
                  type="text"
                  maxLength={100}
                  value={draft.name}
                  onChange={(event) => {
                    const name = event.target.value;

                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            name,
                            slug: slugEdited ? current.slug : slugify(name),
                          }
                        : current,
                    );
                  }}
                  placeholder="Photography"
                  className="mt-2.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white/80 outline-none transition placeholder:text-white/20 focus:border-[var(--helios-orange)]/55 focus:ring-2 focus:ring-[var(--helios-orange)]/10"
                />
              </label>

              <label className="block">
                <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Service URL slug
                </span>

                <div className="mt-2.5 flex min-h-12 overflow-hidden rounded-xl border border-white/10 bg-black/30 focus-within:border-[var(--helios-orange)]/55 focus-within:ring-2 focus-within:ring-[var(--helios-orange)]/10">
                  <span className="flex items-center border-r border-white/[0.08] px-4 text-sm text-white/25">
                    /services/
                  </span>

                  <input
                    type="text"
                    value={draft.slug}
                    onChange={(event) => {
                      setSlugEdited(true);
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              slug: slugify(event.target.value),
                            }
                          : current,
                      );
                    }}
                    placeholder="photography"
                    className="min-w-0 flex-1 border-0 bg-transparent px-4 text-sm text-white/80 outline-none placeholder:text-white/20"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Description
                </span>

                <textarea
                  rows={4}
                  maxLength={500}
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            description: event.target.value,
                          }
                        : current,
                    )
                  }
                  placeholder="Describe how this service appears throughout the portfolio."
                  className="mt-2.5 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white/80 outline-none transition placeholder:text-white/20 focus:border-[var(--helios-orange)]/55 focus:ring-2 focus:ring-[var(--helios-orange)]/10"
                />
              </label>

              {error && (
                <p className="rounded-xl border border-red-300/15 bg-red-300/[0.05] px-4 py-3 text-sm text-red-200/80">
                  {error}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/[0.08] px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
                className="admin-btn-secondary"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving || !draft.name.trim()}
                className="admin-btn-primary"
              >
                {isSaving && (
                  <span className="h-3 w-3 animate-spin rounded-full border border-black/25 border-t-black" />
                )}
                {isSaving ? "Saving service" : "Save service"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
