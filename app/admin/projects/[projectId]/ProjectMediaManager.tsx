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
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  getMediaCollection,
  MEDIA_COLLECTIONS,
  type MediaCategory,
} from "@/lib/media-collections";

import MediaUploader from "./MediaUploader";

type ProjectMediaManagerProps = {
  projectId: string;
};

export type ProjectMediaItem = {
  id: string;
  storageKey: string | null;
  originalFilename: string | null;
  altText?: string | null;
  caption?: string | null;
  mimeType: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  mediaCategory: MediaCategory;
  displayOrder: number;
  visibility: string;
  createdAt: string;
  publicUrl: string;
  isHero: boolean;
};

type MediaListResponse = {
  success: boolean;
  error?: string;
  media?: ProjectMediaItem[];
};

type SetHeroResponse = {
  success: boolean;
  error?: string;
  heroMediaId?: string;
};

type ReorderMediaResponse = {
  success: boolean;
  error?: string;
  mediaCategory?: MediaCategory;
  mediaIds?: string[];
};

type UpdateAssetResponse = {
  success: boolean;
  error?: string;
  media?: ProjectMediaItem;
};

type DeleteAssetResponse = {
  success: boolean;
  error?: string;
  deletedMediaId?: string;
  storageCleanupPending?: boolean;
};

type AssetDraft = {
  originalFilename: string;
  altText: string;
  caption: string;
  mediaCategory: MediaCategory;
  visibility: "VISIBLE" | "HIDDEN";
};

type GalleryDensity = "comfortable" | "compact";

type MediaSelection = {
  mediaCategory: MediaCategory | null;
  mediaIds: Set<string>;
  anchorId: string | null;
};

type SortableMediaCardProps = {
  item: ProjectMediaItem;
  itemIndex: number;
  collectionLabel: string;
  isCollectionSaving: boolean;
  isUpdatingHero: boolean;
  isHeroUpdateLocked: boolean;
  isAssetUpdating: boolean;
  isMenuOpen: boolean;
  density: GalleryDensity;
  isSelected: boolean;
  selectedCount: number;
  onOpenPreview: (mediaId: string) => void;
  onToggleSelection: (mediaId: string, extendRange: boolean) => void;
  onSetHero: (mediaId: string) => void;
  onToggleMenu: (mediaId: string) => void;
  onEdit: (mediaId: string) => void;
  onToggleVisibility: (mediaId: string) => void;
  onDelete: (mediaId: string) => void;
};

function formatFileSize(bytes: number | null) {
  if (bytes === null) {
    return "Size unavailable";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function sortMediaItems(first: ProjectMediaItem, second: ProjectMediaItem) {
  if (first.displayOrder !== second.displayOrder) {
    return first.displayOrder - second.displayOrder;
  }

  return (
    new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()
  );
}

function SortableMediaCard({
  item,
  itemIndex,
  collectionLabel,
  isCollectionSaving,
  isUpdatingHero,
  isHeroUpdateLocked,
  isAssetUpdating,
  isMenuOpen,
  density,
  isSelected,
  selectedCount,
  onOpenPreview,
  onToggleSelection,
  onSetHero,
  onToggleMenu,
  onEdit,
  onToggleVisibility,
  onDelete,
}: SortableMediaCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: isCollectionSaving,
  });

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
        willChange: isDragging ? "transform" : undefined,
      }}
      className={`group relative overflow-hidden border bg-black/25 transition-[border-color,box-shadow,opacity] duration-200 ${
        density === "compact" ? "rounded-xl" : "rounded-2xl"
      } ${
        isDragging
          ? "border-[var(--helios-orange)]/70 opacity-75 shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
          : isSelected
            ? "border-[var(--helios-orange)]/70 shadow-[0_0_0_1px_rgba(255,107,0,0.2),0_18px_45px_rgba(0,0,0,0.4)]"
          : item.isHero
            ? "border-[var(--helios-orange)]/50 shadow-[0_0_30px_rgba(255,107,0,0.08)]"
            : "border-white/[0.08] hover:border-white/[0.18] hover:shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpenPreview(item.id)}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-black text-left"
        aria-label={`Open ${
          item.originalFilename || `${collectionLabel} asset`
        } in fullscreen preview`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/admin/media-thumbnails/${item.id}?width=${
            density === "compact" ? 360 : 640
          }`}
          alt={
            item.altText || item.originalFilename || `${collectionLabel} asset`
          }
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.025]"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/15 opacity-75 transition duration-300 group-hover:opacity-90" />

        <div className="absolute left-12 top-3 flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-white/55 backdrop-blur-md">
            {String(itemIndex + 1).padStart(2, "0")}
          </span>

          {item.isHero && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--helios-orange)]/35 bg-[var(--helios-orange)] px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-black shadow-lg">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="h-3.5 w-3.5"
              >
                <path
                  d="m12 3 2.75 5.58 6.16.9-4.46 4.34 1.05 6.13L12 17.06l-5.5 2.89 1.05-6.13-4.46-4.34 6.16-.9L12 3Z"
                  fill="currentColor"
                />
              </svg>
              Hero image
            </span>
          )}
        </div>

        <span className="absolute right-14 top-3 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-white/55 backdrop-blur-md">
          {item.visibility.toLowerCase()}
        </span>

        <div className="absolute inset-x-0 bottom-0 flex translate-y-3 items-end justify-between gap-4 p-4 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <div>
            <p className="text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-white/45">
              Fullscreen preview
            </p>

            <p className="mt-1 text-sm text-white/80">Click to view</p>
          </div>

          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/75 backdrop-blur-md">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
            >
              <path
                d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleSelection(item.id, event.shiftKey);
        }}
        aria-pressed={isSelected}
        aria-label={`${isSelected ? "Remove" : "Add"} ${
          item.originalFilename || `${collectionLabel} asset`
        } ${isSelected ? "from" : "to"} selection`}
        className={`absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)] ${
          isSelected
            ? "border-[var(--helios-orange)] bg-[var(--helios-orange)] text-black"
            : "border-white/15 bg-black/70 text-white/45 hover:border-[var(--helios-orange)]/60 hover:text-white"
        }`}
      >
        {isSelected ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path d="m6.5 12.5 3.25 3.25 7.75-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="h-3 w-3 rounded-[0.2rem] border border-current" />
        )}
      </button>

      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        disabled={isCollectionSaving}
        className="absolute right-3 top-3 z-10 flex h-8 w-8 touch-none items-center justify-center rounded-full border border-white/15 bg-black/70 text-white/55 shadow-lg backdrop-blur-md transition hover:border-[var(--helios-orange)]/50 hover:bg-[var(--helios-orange)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)] disabled:cursor-wait disabled:opacity-40"
        aria-label={`Reorder ${
          item.originalFilename || `${collectionLabel} asset`
        }, currently position ${itemIndex + 1}${
          isSelected && selectedCount > 1
            ? `, moving ${selectedCount} selected assets`
            : ""
        }`}
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

      <div
        className={`flex items-center justify-between gap-3 ${
          density === "compact" ? "px-3 py-3" : "px-4 py-4"
        }`}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white/70">
            {item.originalFilename || "Untitled asset"}
          </p>

          <div className={`${density === "compact" ? "mt-1 text-[0.65rem]" : "mt-2 text-xs"} flex flex-wrap items-center gap-x-3 gap-y-1 text-white/25`}>
            <span>{formatFileSize(item.fileSize)}</span>

            {density === "comfortable" && item.width && item.height && (
              <>
                <span aria-hidden="true">·</span>

                <span>
                  {item.width} × {item.height}
                </span>
              </>
            )}
          </div>
        </div>

        <div
          data-asset-menu-root
          className="relative flex shrink-0 items-center gap-2"
        >
          <button
            type="button"
            onClick={() => {
              if (!item.isHero && !isHeroUpdateLocked) {
                onSetHero(item.id);
              }
            }}
            disabled={item.isHero || isHeroUpdateLocked}
            className={`inline-flex shrink-0 items-center justify-center rounded-full text-[0.55rem] font-semibold uppercase tracking-[0.14em] transition ${
              density === "compact" ? "min-h-9 px-3" : "min-h-10 px-4"
            } ${
              item.isHero
                ? "cursor-default border border-[var(--helios-orange)]/25 bg-[var(--helios-orange)]/10 text-[var(--helios-orange-hover)]"
                : "border border-white/10 text-white/40 hover:border-[var(--helios-orange)]/40 hover:bg-[var(--helios-orange)] hover:text-black disabled:cursor-wait disabled:opacity-40"
            }`}
          >
            {item.isHero
              ? "Current hero"
              : isUpdatingHero
                ? "Updating"
                : "Set hero"}
          </button>

          <button
            type="button"
            onClick={() => onToggleMenu(item.id)}
            disabled={isAssetUpdating}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-label={`Open actions for ${
              item.originalFilename || "untitled asset"
            }`}
            className={`${density === "compact" ? "h-9 w-9" : "h-10 w-10"} flex items-center justify-center rounded-full border border-white/10 text-white/40 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-white disabled:cursor-wait disabled:opacity-40`}
          >
            {isAssetUpdating ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/20 border-t-white/70" />
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="h-4 w-4"
              >
                <circle cx="5" cy="12" r="1.5" fill="currentColor" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                <circle cx="19" cy="12" r="1.5" fill="currentColor" />
              </svg>
            )}
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              className="absolute bottom-12 right-0 z-30 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#151515]/95 p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.65)] backdrop-blur-xl"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => onEdit(item.id)}
                className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs text-white/65 transition hover:bg-white/[0.06] hover:text-white"
              >
                Edit asset details
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => onToggleVisibility(item.id)}
                className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs text-white/65 transition hover:bg-white/[0.06] hover:text-white"
              >
                {item.visibility === "VISIBLE"
                  ? "Hide from portfolio"
                  : "Show in portfolio"}
              </button>

              <div className="my-1 border-t border-white/[0.07]" />

              <button
                type="button"
                role="menuitem"
                onClick={() => onDelete(item.id)}
                className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs text-red-200/65 transition hover:bg-red-300/[0.07] hover:text-red-100"
              >
                Delete asset
              </button>
            </div>
          )}
        </div>
      </div>

      {isUpdatingHero && (
        <div className="border-t border-white/[0.07] px-4 py-3">
          <div className="flex items-center gap-2 text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-white/40">
            <span className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/70" />
            Updating hero image
          </div>
        </div>
      )}
    </article>
  );
}

export default function ProjectMediaManager({
  projectId,
}: ProjectMediaManagerProps) {
  const [media, setMedia] = useState<ProjectMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [updatingHeroId, setUpdatingHeroId] = useState<string | null>(null);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [updatingAssetId, setUpdatingAssetId] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [assetDraft, setAssetDraft] = useState<AssetDraft | null>(null);
  const [savingCollections, setSavingCollections] = useState<MediaCategory[]>(
    [],
  );
  const [reorderErrors, setReorderErrors] = useState<
    Partial<Record<MediaCategory, string>>
  >({});
  const [galleryDensity, setGalleryDensity] =
    useState<GalleryDensity>("comfortable");
  const [selection, setSelection] = useState<MediaSelection>({
    mediaCategory: null,
    mediaIds: new Set(),
    anchorId: null,
  });

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

  const groupedCollections = useMemo(
    () =>
      MEDIA_COLLECTIONS.map((collection) => ({
        collection,
        items: media
          .filter((item) => item.mediaCategory === collection.value)
          .sort(sortMediaItems),
      })).filter((group) => group.items.length > 0),
    [media],
  );

  useEffect(() => {
    const savedDensity = window.localStorage.getItem(
      "helios-admin-media-density",
    );

    if (savedDensity === "comfortable" || savedDensity === "compact") {
      setGalleryDensity(savedDensity);
    }
  }, []);

  const changeGalleryDensity = useCallback((density: GalleryDensity) => {
    setGalleryDensity(density);
    window.localStorage.setItem("helios-admin-media-density", density);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection({
      mediaCategory: null,
      mediaIds: new Set(),
      anchorId: null,
    });
  }, []);

  const toggleMediaSelection = useCallback(
    (
      mediaCategory: MediaCategory,
      mediaId: string,
      extendRange: boolean,
    ) => {
      const collectionItems = media
        .filter((item) => item.mediaCategory === mediaCategory)
        .sort(sortMediaItems);

      setSelection((current) => {
        if (current.mediaCategory !== mediaCategory) {
          return {
            mediaCategory,
            mediaIds: new Set([mediaId]),
            anchorId: mediaId,
          };
        }

        const nextIds = new Set(current.mediaIds);

        if (extendRange && current.anchorId) {
          const anchorIndex = collectionItems.findIndex(
            (item) => item.id === current.anchorId,
          );
          const targetIndex = collectionItems.findIndex(
            (item) => item.id === mediaId,
          );

          if (anchorIndex >= 0 && targetIndex >= 0) {
            const startIndex = Math.min(anchorIndex, targetIndex);
            const endIndex = Math.max(anchorIndex, targetIndex);

            collectionItems
              .slice(startIndex, endIndex + 1)
              .forEach((item) => nextIds.add(item.id));
          }
        } else if (nextIds.has(mediaId)) {
          nextIds.delete(mediaId);
        } else {
          nextIds.add(mediaId);
        }

        return nextIds.size > 0
          ? {
              mediaCategory,
              mediaIds: nextIds,
              anchorId: mediaId,
            }
          : {
              mediaCategory: null,
              mediaIds: new Set(),
              anchorId: null,
            };
      });
    },
    [media],
  );

  const selectCollection = useCallback(
    (mediaCategory: MediaCategory) => {
      const mediaIds = new Set(
        media
          .filter((item) => item.mediaCategory === mediaCategory)
          .map((item) => item.id),
      );

      setSelection({
        mediaCategory,
        mediaIds,
        anchorId: mediaIds.values().next().value ?? null,
      });
    },
    [media],
  );

  useEffect(() => {
    setSelection((current) => {
      if (!current.mediaCategory || current.mediaIds.size === 0) {
        return current;
      }

      const availableIds = new Set(
        media
          .filter((item) => item.mediaCategory === current.mediaCategory)
          .map((item) => item.id),
      );
      const validIds = new Set(
        [...current.mediaIds].filter((mediaId) => availableIds.has(mediaId)),
      );

      if (validIds.size === current.mediaIds.size) {
        return current;
      }

      return validIds.size > 0
        ? {
            ...current,
            mediaIds: validIds,
            anchorId:
              current.anchorId && validIds.has(current.anchorId)
                ? current.anchorId
                : (validIds.values().next().value ?? null),
          }
        : {
            mediaCategory: null,
            mediaIds: new Set(),
            anchorId: null,
          };
    });
  }, [media]);

  const activeMedia = useMemo(
    () => media.find((item) => item.id === activeMediaId) ?? null,
    [activeMediaId, media],
  );

  const editingMedia = useMemo(
    () => media.find((item) => item.id === editingMediaId) ?? null,
    [editingMediaId, media],
  );

  const deletingMedia = useMemo(
    () => media.find((item) => item.id === deletingMediaId) ?? null,
    [deletingMediaId, media],
  );

  const activeCollectionMedia = useMemo(() => {
    if (!activeMedia) {
      return [];
    }

    return media
      .filter((item) => item.mediaCategory === activeMedia.mediaCategory)
      .sort(sortMediaItems);
  }, [activeMedia, media]);

  const activeMediaIndex = useMemo(
    () => activeCollectionMedia.findIndex((item) => item.id === activeMediaId),
    [activeCollectionMedia, activeMediaId],
  );

  const loadMedia = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/projects/${projectId}/media`, {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as MediaListResponse;

      if (!response.ok || !data.success || !data.media) {
        throw new Error(data.error || "The project media could not be loaded.");
      }

      setMedia(data.media);
    } catch (loadError) {
      console.error("Unable to load project media:", loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "The project media could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const handleMediaUploaded = useCallback((uploadedMedia: ProjectMediaItem) => {
    setMedia((currentMedia) => {
      const normalizedMedia = {
        ...uploadedMedia,
        isHero: uploadedMedia.isHero ?? false,
      };

      const existingIndex = currentMedia.findIndex(
        (item) => item.id === normalizedMedia.id,
      );

      if (existingIndex >= 0) {
        return currentMedia.map((item) =>
          item.id === normalizedMedia.id ? normalizedMedia : item,
        );
      }

      return [...currentMedia, normalizedMedia];
    });
  }, []);

  const handleSetHero = useCallback(
    async (mediaId: string) => {
      try {
        setUpdatingHeroId(mediaId);
        setHeroError(null);

        const response = await fetch(`/api/admin/projects/${projectId}/media`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "set-hero",
            mediaId,
          }),
        });

        const data = (await response.json()) as SetHeroResponse;

        if (!response.ok || !data.success || !data.heroMediaId) {
          throw new Error(data.error || "The hero image could not be updated.");
        }

        setMedia((currentMedia) =>
          currentMedia.map((item) => ({
            ...item,
            isHero: item.id === data.heroMediaId,
          })),
        );
      } catch (updateError) {
        console.error("Unable to update project hero image:", updateError);

        setHeroError(
          updateError instanceof Error
            ? updateError.message
            : "The hero image could not be updated.",
        );
      } finally {
        setUpdatingHeroId(null);
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Element &&
        !target.closest("[data-asset-menu-root]")
      ) {
        setOpenMenuId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  const updateAsset = useCallback(
    async (item: ProjectMediaItem, draft: AssetDraft) => {
      try {
        setUpdatingAssetId(item.id);
        setAssetError(null);

        const response = await fetch(`/api/admin/projects/${projectId}/media`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "update-asset",
            mediaId: item.id,
            ...draft,
          }),
        });

        const data = (await response.json()) as UpdateAssetResponse;

        if (!response.ok || !data.success || !data.media) {
          throw new Error(data.error || "The asset could not be updated.");
        }

        const updatedMedia = data.media;

        setMedia((currentMedia) =>
          currentMedia.map((currentItem) =>
            currentItem.id === updatedMedia.id ? updatedMedia : currentItem,
          ),
        );

        return true;
      } catch (updateError) {
        console.error("Unable to update project asset:", updateError);
        setAssetError(
          updateError instanceof Error
            ? updateError.message
            : "The asset could not be updated.",
        );
        return false;
      } finally {
        setUpdatingAssetId(null);
      }
    },
    [projectId],
  );

  const beginEditingAsset = useCallback(
    (mediaId: string) => {
      const item = media.find((mediaItem) => mediaItem.id === mediaId);

      if (!item) {
        return;
      }

      setAssetDraft({
        originalFilename: item.originalFilename || "Untitled asset",
        altText: item.altText || "",
        caption: item.caption || "",
        mediaCategory: item.mediaCategory,
        visibility: item.visibility === "HIDDEN" ? "HIDDEN" : "VISIBLE",
      });
      setEditingMediaId(item.id);
      setOpenMenuId(null);
      setAssetError(null);
    },
    [media],
  );

  const saveAssetDetails = useCallback(async () => {
    if (!editingMedia || !assetDraft) {
      return;
    }

    const didSave = await updateAsset(editingMedia, assetDraft);

    if (didSave) {
      setEditingMediaId(null);
      setAssetDraft(null);
    }
  }, [assetDraft, editingMedia, updateAsset]);

  const toggleAssetVisibility = useCallback(
    async (mediaId: string) => {
      const item = media.find((mediaItem) => mediaItem.id === mediaId);

      if (!item) {
        return;
      }

      setOpenMenuId(null);

      await updateAsset(item, {
        originalFilename: item.originalFilename || "Untitled asset",
        altText: item.altText || "",
        caption: item.caption || "",
        mediaCategory: item.mediaCategory,
        visibility: item.visibility === "VISIBLE" ? "HIDDEN" : "VISIBLE",
      });
    },
    [media, updateAsset],
  );

  const beginDeletingAsset = useCallback((mediaId: string) => {
    setDeletingMediaId(mediaId);
    setOpenMenuId(null);
    setAssetError(null);
  }, []);

  const confirmDeleteAsset = useCallback(async () => {
    if (!deletingMedia) {
      return;
    }

    try {
      setUpdatingAssetId(deletingMedia.id);
      setAssetError(null);

      const response = await fetch(`/api/admin/projects/${projectId}/media`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mediaId: deletingMedia.id,
        }),
      });

      const data = (await response.json()) as DeleteAssetResponse;

      if (!response.ok || !data.success || !data.deletedMediaId) {
        throw new Error(data.error || "The asset could not be deleted.");
      }

      setMedia((currentMedia) =>
        currentMedia.filter((item) => item.id !== data.deletedMediaId),
      );

      if (activeMediaId === data.deletedMediaId) {
        setActiveMediaId(null);
      }

      setDeletingMediaId(null);

      if (data.storageCleanupPending) {
        setAssetError(
          "The asset was removed from the project, but its storage cleanup is still pending.",
        );
      }
    } catch (deleteError) {
      console.error("Unable to delete project asset:", deleteError);
      setAssetError(
        deleteError instanceof Error
          ? deleteError.message
          : "The asset could not be deleted.",
      );
    } finally {
      setUpdatingAssetId(null);
    }
  }, [activeMediaId, deletingMedia, projectId]);

  const handleReorder = useCallback(
    async (mediaCategory: MediaCategory, activeId: string, overId: string) => {
      const collectionItems = media
        .filter((item) => item.mediaCategory === mediaCategory)
        .sort(sortMediaItems);

      const activeIndex = collectionItems.findIndex(
        (item) => item.id === activeId,
      );
      const overIndex = collectionItems.findIndex((item) => item.id === overId);
      const selectedIds =
        selection.mediaCategory === mediaCategory &&
        selection.mediaIds.has(activeId)
          ? selection.mediaIds
          : new Set([activeId]);

      if (
        activeIndex < 0 ||
        overIndex < 0 ||
        selectedIds.has(overId) ||
        savingCollections.includes(mediaCategory)
      ) {
        return;
      }

      const movingItems = collectionItems.filter((item) =>
        selectedIds.has(item.id),
      );
      const stationaryItems = collectionItems.filter(
        (item) => !selectedIds.has(item.id),
      );
      const stationaryOverIndex = stationaryItems.findIndex(
        (item) => item.id === overId,
      );
      const insertIndex =
        stationaryOverIndex + (activeIndex < overIndex ? 1 : 0);
      const reorderedItems = [
        ...stationaryItems.slice(0, insertIndex),
        ...movingItems,
        ...stationaryItems.slice(insertIndex),
      ].map((item, index) => ({
          ...item,
          displayOrder: index,
        }));

      const reorderedOrderById = new Map(
        reorderedItems.map((item) => [item.id, item.displayOrder]),
      );

      setMedia((currentMedia) =>
        currentMedia.map((item) => {
          const displayOrder = reorderedOrderById.get(item.id);

          return item.mediaCategory === mediaCategory &&
            displayOrder !== undefined
            ? {
                ...item,
                displayOrder,
              }
            : item;
        }),
      );
      setSavingCollections((current) => [...current, mediaCategory]);
      setReorderErrors((current) => ({
        ...current,
        [mediaCategory]: undefined,
      }));

      try {
        const mediaIds = reorderedItems.map((item) => item.id);
        const response = await fetch(`/api/admin/projects/${projectId}/media`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "reorder",
            mediaCategory,
            mediaIds,
          }),
        });

        const data = (await response.json()) as ReorderMediaResponse;

        if (!response.ok || !data.success || !data.mediaIds) {
          throw new Error(
            data.error || "The new asset order could not be saved.",
          );
        }

        if (
          data.mediaIds.length !== mediaIds.length ||
          data.mediaIds.some((mediaId, index) => mediaId !== mediaIds[index])
        ) {
          throw new Error(
            "The saved asset order did not match the requested order.",
          );
        }
      } catch (reorderError) {
        console.error("Unable to reorder project media:", reorderError);

        const previousOrderById = new Map(
          collectionItems.map((item) => [item.id, item.displayOrder]),
        );

        setMedia((currentMedia) =>
          currentMedia.map((item) => {
            const displayOrder = previousOrderById.get(item.id);

            return item.mediaCategory === mediaCategory &&
              displayOrder !== undefined
              ? {
                  ...item,
                  displayOrder,
                }
              : item;
          }),
        );
        setReorderErrors((current) => ({
          ...current,
          [mediaCategory]:
            reorderError instanceof Error
              ? reorderError.message
              : "The new asset order could not be saved.",
        }));
      } finally {
        setSavingCollections((current) =>
          current.filter((category) => category !== mediaCategory),
        );
      }
    },
    [media, projectId, savingCollections, selection],
  );

  const handleDragEnd = useCallback(
    (mediaCategory: MediaCategory, event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      void handleReorder(mediaCategory, String(active.id), String(over.id));
    },
    [handleReorder],
  );

  const closePreview = useCallback(() => {
    setActiveMediaId(null);
  }, []);

  const showPreviousMedia = useCallback(() => {
    if (activeCollectionMedia.length < 2 || activeMediaIndex < 0) {
      return;
    }

    const previousIndex =
      activeMediaIndex === 0
        ? activeCollectionMedia.length - 1
        : activeMediaIndex - 1;

    setActiveMediaId(activeCollectionMedia[previousIndex].id);
  }, [activeCollectionMedia, activeMediaIndex]);

  const showNextMedia = useCallback(() => {
    if (activeCollectionMedia.length < 2 || activeMediaIndex < 0) {
      return;
    }

    const nextIndex =
      activeMediaIndex === activeCollectionMedia.length - 1
        ? 0
        : activeMediaIndex + 1;

    setActiveMediaId(activeCollectionMedia[nextIndex].id);
  }, [activeCollectionMedia, activeMediaIndex]);

  useEffect(() => {
    if (!activeMedia) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
      }

      if (event.key === "ArrowLeft") {
        showPreviousMedia();
      }

      if (event.key === "ArrowRight") {
        showNextMedia();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMedia, closePreview, showNextMedia, showPreviousMedia]);

  useEffect(() => {
    if (!editingMedia && !deletingMedia) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || updatingAssetId) {
        return;
      }

      setEditingMediaId(null);
      setDeletingMediaId(null);
      setAssetDraft(null);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [deletingMedia, editingMedia, updatingAssetId]);

  return (
    <>
      <div className="space-y-8">
        <MediaUploader
          projectId={projectId}
          onMediaUploaded={handleMediaUploaded}
        />

        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="flex flex-col gap-3 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.19em] text-[var(--helios-orange)]">
                Portfolio assets
              </p>

              <h3 className="mt-3 text-2xl font-normal text-white sm:text-3xl">
                Media collections
              </h3>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/35">
                Manage every project asset by collection. Open any image for a
                fullscreen preview or select the image that should lead the
                project.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div
                role="group"
                aria-label="Asset card size"
                className="inline-flex rounded-xl border border-white/[0.09] bg-black/30 p-1"
              >
                <button
                  type="button"
                  onClick={() => changeGalleryDensity("comfortable")}
                  aria-pressed={galleryDensity === "comfortable"}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                    galleryDensity === "comfortable"
                      ? "bg-white/[0.11] text-white"
                      : "text-white/30 hover:text-white/65"
                  }`}
                  aria-label="Use comfortable asset cards"
                  title="Comfortable cards"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => changeGalleryDensity("compact")}
                  aria-pressed={galleryDensity === "compact"}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                    galleryDensity === "compact"
                      ? "bg-white/[0.11] text-white"
                      : "text-white/30 hover:text-white/65"
                  }`}
                  aria-label="Use compact asset thumbnails"
                  title="Compact thumbnails"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                    {Array.from({ length: 9 }).map((_, index) => (
                      <rect
                        key={index}
                        x={3 + (index % 3) * 7}
                        y={3 + Math.floor(index / 3) * 7}
                        width="4"
                        height="4"
                        rx="0.6"
                        fill="currentColor"
                      />
                    ))}
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs text-white/25">
                <span>
                  {groupedCollections.length}{" "}
                  {groupedCollections.length === 1
                    ? "collection"
                    : "collections"}
                </span>

                <span aria-hidden="true">·</span>

                <span>
                  {media.length} {media.length === 1 ? "asset" : "assets"}
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {heroError && (
              <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-red-300/15 bg-red-300/[0.05] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-red-200/80">{heroError}</p>

                <button
                  type="button"
                  onClick={() => setHeroError(null)}
                  className="self-start text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-red-200/60 transition hover:text-red-100 sm:self-auto"
                >
                  Dismiss
                </button>
              </div>
            )}

            {assetError && (
              <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-red-300/15 bg-red-300/[0.05] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-red-200/80">{assetError}</p>

                <button
                  type="button"
                  onClick={() => setAssetError(null)}
                  className="self-start text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-red-200/60 transition hover:text-red-100 sm:self-auto"
                >
                  Dismiss
                </button>
              </div>
            )}

            {isLoading && (
              <div className="space-y-8">
                {Array.from({ length: 2 }).map((_, collectionIndex) => (
                  <div
                    key={collectionIndex}
                    className="overflow-hidden rounded-2xl border border-white/[0.07] bg-black/15"
                  >
                    <div className="h-24 animate-pulse border-b border-white/[0.06] bg-white/[0.025]" />

                    <div className="grid gap-5 p-5 sm:grid-cols-2 xl:grid-cols-3">
                      {Array.from({ length: 3 }).map((_, itemIndex) => (
                        <div
                          key={itemIndex}
                          className="aspect-[4/3] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.035]"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && error && (
              <div className="rounded-2xl border border-red-300/15 bg-red-300/[0.05] px-6 py-10 text-center">
                <p className="text-sm text-red-200/80">{error}</p>

                <button
                  type="button"
                  onClick={() => void loadMedia()}
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 px-5 text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-white/60 transition hover:border-white/25 hover:text-white"
                >
                  Try again
                </button>
              </div>
            )}

            {!isLoading && !error && media.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/[0.1] bg-black/20 px-6 py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/30">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5"
                  >
                    <path
                      d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25H6.75a2.25 2.25 0 0 1-2.25-2.25V6.75Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />

                    <path
                      d="m5 16 4.25-4.25a1.5 1.5 0 0 1 2.12 0l1.38 1.38 1.38-1.38a1.5 1.5 0 0 1 2.12 0L19 14.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <circle cx="15.75" cy="8.25" r="1.25" fill="currentColor" />
                  </svg>
                </div>

                <h4 className="mt-5 text-xl font-normal text-white">
                  No media saved yet
                </h4>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/35">
                  Select a collection above and upload the first project assets.
                  Each collection will appear here automatically.
                </p>
              </div>
            )}

            {!isLoading && !error && groupedCollections.length > 0 && (
              <div className="space-y-8">
                {groupedCollections.map(({ collection, items }, groupIndex) => {
                  const isCollectionSaving = savingCollections.includes(
                    collection.value,
                  );
                  const reorderError = reorderErrors[collection.value];

                  return (
                    <section
                      key={collection.value}
                      className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20"
                    >
                      <div className="flex flex-col gap-4 border-b border-white/[0.07] bg-white/[0.018] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-4">
                          <span className="mt-0.5 flex h-9 min-w-9 items-center justify-center rounded-full border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.06] px-2 text-[0.56rem] font-semibold tracking-[0.14em] text-[var(--helios-orange)]">
                            {String(groupIndex + 1).padStart(2, "0")}
                          </span>

                          <div>
                            <p className="text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-white/30">
                              Media collection
                            </p>

                            <h4 className="mt-1.5 text-xl font-normal text-white">
                              {collection.label}
                            </h4>

                            {items.length > 1 && (
                              <p className="mt-1.5 text-xs leading-5 text-white/25">
                                Select assets to move them together, then drag
                                any selected handle. Shift-select adds a range.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-3">
                          {selection.mediaCategory === collection.value &&
                            selection.mediaIds.size > 0 && (
                              <span className="rounded-full border border-[var(--helios-orange)]/25 bg-[var(--helios-orange)]/[0.08] px-4 py-2 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-[var(--helios-orange-hover)]">
                                {selection.mediaIds.size} selected
                              </span>
                            )}

                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                selection.mediaCategory === collection.value &&
                                selection.mediaIds.size === items.length
                                  ? clearSelection()
                                  : selectCollection(collection.value)
                              }
                              className="text-[0.56rem] font-semibold uppercase tracking-[0.15em] text-white/35 transition hover:text-white/70"
                            >
                              {selection.mediaCategory === collection.value &&
                              selection.mediaIds.size === items.length
                                ? "Clear selection"
                                : "Select all"}
                            </button>
                          )}

                          {isCollectionSaving && (
                            <span
                              role="status"
                              className="inline-flex items-center gap-2 text-[0.56rem] font-semibold uppercase tracking-[0.15em] text-[var(--helios-orange)]/80"
                            >
                              <span className="h-3 w-3 animate-spin rounded-full border border-[var(--helios-orange)]/25 border-t-[var(--helios-orange)]" />
                              Saving order
                            </span>
                          )}

                          <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-white/35">
                            {items.length}{" "}
                            {items.length === 1 ? "asset" : "assets"}
                          </span>
                        </div>
                      </div>

                      {reorderError && (
                        <div className="flex flex-col gap-3 border-b border-red-300/10 bg-red-300/[0.045] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-red-200/75">
                            {reorderError}
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              setReorderErrors((current) => ({
                                ...current,
                                [collection.value]: undefined,
                              }))
                            }
                            className="self-start text-[0.56rem] font-semibold uppercase tracking-[0.15em] text-red-200/55 transition hover:text-red-100 sm:self-auto"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}

                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) =>
                          handleDragEnd(collection.value, event)
                        }
                      >
                        <SortableContext
                          items={items.map((item) => item.id)}
                          strategy={rectSortingStrategy}
                        >
                          <div
                            className={`grid p-5 ${
                              galleryDensity === "compact"
                                ? "gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
                                : "gap-5 sm:grid-cols-2 xl:grid-cols-3"
                            }`}
                          >
                            {items.map((item, itemIndex) => (
                              <SortableMediaCard
                                key={item.id}
                                item={item}
                                itemIndex={itemIndex}
                                collectionLabel={collection.label}
                                isCollectionSaving={isCollectionSaving}
                                isUpdatingHero={updatingHeroId === item.id}
                                isHeroUpdateLocked={updatingHeroId !== null}
                                isAssetUpdating={updatingAssetId === item.id}
                                isMenuOpen={openMenuId === item.id}
                                density={galleryDensity}
                                isSelected={
                                  selection.mediaCategory === collection.value &&
                                  selection.mediaIds.has(item.id)
                                }
                                selectedCount={
                                  selection.mediaCategory === collection.value
                                    ? selection.mediaIds.size
                                    : 0
                                }
                                onOpenPreview={setActiveMediaId}
                                onToggleSelection={(mediaId, extendRange) =>
                                  toggleMediaSelection(
                                    collection.value,
                                    mediaId,
                                    extendRange,
                                  )
                                }
                                onSetHero={(mediaId) =>
                                  void handleSetHero(mediaId)
                                }
                                onToggleMenu={(mediaId) =>
                                  setOpenMenuId((current) =>
                                    current === mediaId ? null : mediaId,
                                  )
                                }
                                onEdit={beginEditingAsset}
                                onToggleVisibility={(mediaId) =>
                                  void toggleAssetVisibility(mediaId)
                                }
                                onDelete={beginDeletingAsset}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {activeMedia && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen project media preview"
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={closePreview}
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Close fullscreen preview"
          />

          <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between border-b border-white/[0.08] bg-black/40 px-4 py-4 backdrop-blur-xl sm:px-6">
            <div className="min-w-0">
              <p className="text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">
                {getMediaCollection(activeMedia.mediaCategory).label}
              </p>

              <p className="mt-1 truncate text-sm text-white/65">
                {activeMedia.originalFilename || "Untitled asset"}
              </p>
            </div>

            <div className="pointer-events-auto flex items-center gap-3">
              <p className="hidden text-xs text-white/30 sm:block">
                {activeMediaIndex + 1} of {activeCollectionMedia.length}
              </p>

              <button
                type="button"
                onClick={closePreview}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
                aria-label="Close fullscreen preview"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
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
          </header>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 pb-28 pt-24 sm:px-20 sm:pb-32">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeMedia.publicUrl}
              alt={
                activeMedia.altText ||
                activeMedia.originalFilename ||
                "Project media asset"
              }
              className="max-h-full max-w-full rounded-lg object-contain shadow-[0_35px_100px_rgba(0,0,0,0.65)]"
            />
          </div>

          {activeCollectionMedia.length > 1 && (
            <>
              <button
                type="button"
                onClick={showPreviousMedia}
                className="absolute left-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white/60 backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white sm:left-6 sm:h-14 sm:w-14"
                aria-label="View previous asset"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                >
                  <path
                    d="m15 6-6 6 6 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <button
                type="button"
                onClick={showNextMedia}
                className="absolute right-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white/60 backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white sm:right-6 sm:h-14 sm:w-14"
                aria-label="View next asset"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                >
                  <path
                    d="m9 6 6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          )}

          <footer className="absolute inset-x-0 bottom-0 z-20 border-t border-white/[0.08] bg-black/50 px-4 py-4 backdrop-blur-xl sm:px-6">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/35">
                <span className="font-semibold uppercase tracking-[0.13em] text-[var(--helios-orange)]">
                  {getMediaCollection(activeMedia.mediaCategory).label}
                </span>

                <span aria-hidden="true">·</span>

                <span>{formatFileSize(activeMedia.fileSize)}</span>

                {activeMedia.width && activeMedia.height && (
                  <>
                    <span aria-hidden="true">·</span>

                    <span>
                      {activeMedia.width} × {activeMedia.height}
                    </span>
                  </>
                )}

                <span aria-hidden="true">·</span>

                <span className="uppercase tracking-[0.13em]">
                  {activeMedia.visibility.toLowerCase()}
                </span>

                {activeMedia.isHero && (
                  <>
                    <span aria-hidden="true">·</span>

                    <span className="font-semibold uppercase tracking-[0.13em] text-[var(--helios-orange)]">
                      Hero image
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!activeMedia.isHero && updatingHeroId === null) {
                    void handleSetHero(activeMedia.id);
                  }
                }}
                disabled={activeMedia.isHero || updatingHeroId !== null}
                className={`inline-flex min-h-11 items-center justify-center rounded-full px-6 text-[0.58rem] font-semibold uppercase tracking-[0.15em] transition ${
                  activeMedia.isHero
                    ? "cursor-default border border-[var(--helios-orange)]/25 bg-[var(--helios-orange)]/10 text-[var(--helios-orange-hover)]"
                    : "bg-[var(--helios-orange)] text-black hover:bg-[var(--helios-orange-hover)] disabled:cursor-wait disabled:opacity-50"
                }`}
              >
                {activeMedia.isHero
                  ? "Current hero image"
                  : updatingHeroId === activeMedia.id
                    ? "Setting hero"
                    : "Set as hero image"}
              </button>
            </div>
          </footer>
        </div>
      )}

      {editingMedia && assetDraft && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-asset-title"
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 px-4 py-8 backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={() => {
              if (!updatingAssetId) {
                setEditingMediaId(null);
                setAssetDraft(null);
              }
            }}
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Close asset editor"
          />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveAssetDetails();
            }}
            className="relative z-10 max-h-full w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#111111] shadow-[0_40px_120px_rgba(0,0,0,0.75)]"
          >
            <div className="flex items-start justify-between gap-6 border-b border-white/[0.08] px-6 py-6 sm:px-8">
              <div>
                <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">
                  Asset management
                </p>

                <h3
                  id="edit-asset-title"
                  className="mt-3 text-2xl font-normal text-white sm:text-3xl"
                >
                  Edit asset details
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/35">
                  Update portfolio metadata, visibility, and collection.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!updatingAssetId) {
                    setEditingMediaId(null);
                    setAssetDraft(null);
                  }
                }}
                disabled={updatingAssetId !== null}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/45 transition hover:border-white/25 hover:bg-white/[0.05] hover:text-white disabled:cursor-wait disabled:opacity-40"
                aria-label="Close asset editor"
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

            <div className="space-y-7 px-6 py-7 sm:px-8">
              <label className="block">
                <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Asset filename
                </span>

                <input
                  type="text"
                  required
                  maxLength={255}
                  value={assetDraft.originalFilename}
                  onChange={(event) =>
                    setAssetDraft((current) =>
                      current
                        ? {
                            ...current,
                            originalFilename: event.target.value,
                          }
                        : current,
                    )
                  }
                  className="mt-2.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white/80 outline-none transition placeholder:text-white/20 focus:border-[var(--helios-orange)]/55 focus:ring-2 focus:ring-[var(--helios-orange)]/10"
                />
              </label>

              <label className="block">
                <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Alt text
                </span>

                <input
                  type="text"
                  maxLength={500}
                  value={assetDraft.altText}
                  onChange={(event) =>
                    setAssetDraft((current) =>
                      current
                        ? {
                            ...current,
                            altText: event.target.value,
                          }
                        : current,
                    )
                  }
                  placeholder="Describe the image for accessibility and search"
                  className="mt-2.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white/80 outline-none transition placeholder:text-white/20 focus:border-[var(--helios-orange)]/55 focus:ring-2 focus:ring-[var(--helios-orange)]/10"
                />
              </label>

              <label className="block">
                <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Caption
                </span>

                <textarea
                  rows={3}
                  maxLength={2000}
                  value={assetDraft.caption}
                  onChange={(event) =>
                    setAssetDraft((current) =>
                      current
                        ? {
                            ...current,
                            caption: event.target.value,
                          }
                        : current,
                    )
                  }
                  placeholder="Optional portfolio caption"
                  className="mt-2.5 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white/80 outline-none transition placeholder:text-white/20 focus:border-[var(--helios-orange)]/55 focus:ring-2 focus:ring-[var(--helios-orange)]/10"
                />
              </label>

              <fieldset>
                <legend className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Portfolio visibility
                </legend>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(["VISIBLE", "HIDDEN"] as const).map((visibility) => {
                    const isSelected = assetDraft.visibility === visibility;

                    return (
                      <button
                        key={visibility}
                        type="button"
                        onClick={() =>
                          setAssetDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  visibility,
                                }
                              : current,
                          )
                        }
                        aria-pressed={isSelected}
                        className={`rounded-xl border px-4 py-3 text-left transition ${
                          isSelected
                            ? "border-[var(--helios-orange)]/50 bg-[var(--helios-orange)]/[0.08] text-white"
                            : "border-white/[0.08] bg-white/[0.02] text-white/40 hover:border-white/20 hover:text-white/70"
                        }`}
                      >
                        <span className="block text-xs font-semibold uppercase tracking-[0.14em]">
                          {visibility === "VISIBLE" ? "Visible" : "Hidden"}
                        </span>

                        <span className="mt-1.5 block text-xs leading-5 opacity-55">
                          {visibility === "VISIBLE"
                            ? "Available to published portfolio experiences."
                            : "Retained in the DAM but excluded publicly."}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Media collection
                </legend>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {MEDIA_COLLECTIONS.map((collection) => {
                    const isSelected =
                      assetDraft.mediaCategory === collection.value;

                    return (
                      <button
                        key={collection.value}
                        type="button"
                        onClick={() =>
                          setAssetDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  mediaCategory: collection.value,
                                }
                              : current,
                          )
                        }
                        aria-pressed={isSelected}
                        className={`min-h-12 rounded-xl border px-4 py-3 text-left text-xs transition ${
                          isSelected
                            ? "border-[var(--helios-orange)]/50 bg-[var(--helios-orange)]/[0.08] text-white"
                            : "border-white/[0.08] bg-white/[0.02] text-white/40 hover:border-white/20 hover:text-white/70"
                        }`}
                      >
                        {collection.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {assetError && (
                <p className="rounded-xl border border-red-300/15 bg-red-300/[0.05] px-4 py-3 text-sm text-red-200/80">
                  {assetError}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/[0.08] px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
              <button
                type="button"
                onClick={() => {
                  setEditingMediaId(null);
                  setAssetDraft(null);
                }}
                disabled={updatingAssetId !== null}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 px-6 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-white/45 transition hover:border-white/25 hover:text-white disabled:cursor-wait disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  updatingAssetId !== null ||
                  !assetDraft.originalFilename.trim()
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--helios-orange)] px-7 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-black transition hover:bg-[var(--helios-orange-hover)] disabled:cursor-wait disabled:opacity-45"
              >
                {updatingAssetId === editingMedia.id && (
                  <span className="h-3 w-3 animate-spin rounded-full border border-black/25 border-t-black" />
                )}
                {updatingAssetId === editingMedia.id
                  ? "Saving asset"
                  : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingMedia && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-asset-title"
          aria-describedby="delete-asset-description"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 px-4 backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={() => {
              if (!updatingAssetId) {
                setDeletingMediaId(null);
              }
            }}
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Cancel asset deletion"
          />

          <div className="relative z-10 w-full max-w-lg rounded-3xl border border-red-300/15 bg-[#111111] p-7 shadow-[0_40px_120px_rgba(0,0,0,0.75)] sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-300/20 bg-red-300/[0.07] text-red-200/70">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
              >
                <path
                  d="M9 3h6m-9 4h12m-10.5 0 .75 13h7.5l.75-13M10 10.5v6M14 10.5v6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h3
              id="delete-asset-title"
              className="mt-5 text-2xl font-normal text-white"
            >
              Permanently delete this asset?
            </h3>

            <p
              id="delete-asset-description"
              className="mt-3 text-sm leading-6 text-white/40"
            >
              <span className="text-white/65">
                {deletingMedia.originalFilename || "Untitled asset"}
              </span>{" "}
              will be removed from this project and Cloudflare R2. This action
              cannot be undone.
              {deletingMedia.isHero && (
                <span className="mt-3 block text-[var(--helios-orange)]/80">
                  This is the current hero image. The project will have no hero
                  image until another asset is selected.
                </span>
              )}
            </p>

            {assetError && (
              <p className="mt-5 rounded-xl border border-red-300/15 bg-red-300/[0.05] px-4 py-3 text-sm text-red-200/80">
                {assetError}
              </p>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeletingMediaId(null)}
                disabled={updatingAssetId !== null}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 px-6 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-white/45 transition hover:border-white/25 hover:text-white disabled:cursor-wait disabled:opacity-40"
              >
                Keep asset
              </button>

              <button
                type="button"
                onClick={() => void confirmDeleteAsset()}
                disabled={updatingAssetId !== null}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-300 px-7 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-black transition hover:bg-red-200 disabled:cursor-wait disabled:opacity-45"
              >
                {updatingAssetId === deletingMedia.id && (
                  <span className="h-3 w-3 animate-spin rounded-full border border-black/25 border-t-black" />
                )}
                {updatingAssetId === deletingMedia.id
                  ? "Deleting asset"
                  : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
