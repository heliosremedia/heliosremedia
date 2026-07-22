"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { tryResolveExternalMedia } from "@/lib/external-media";
import type { MediaCategory } from "@/lib/media-collections";

export type LibraryMediaItem = {
  id: string;
  originalFilename: string | null;
  altText: string | null;
  caption: string | null;
  mimeType: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  mediaCategory: MediaCategory;
  collectionLabel: string;
  visibility: "VISIBLE" | "HIDDEN";
  createdAt: string;
  publicUrl: string | null;
  externalUrl: string | null;
  isHero: boolean;
  projectFilterUrl: string;
  project: {
    id: string;
    title: string;
    slug: string;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  };
};

type MediaLibraryGridProps = {
  items: LibraryMediaItem[];
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

function formatDimensions(item: LibraryMediaItem) {
  return item.width && item.height
    ? `${item.width} × ${item.height}`
    : "Dimensions unavailable";
}

function statusClasses(status: LibraryMediaItem["project"]["status"]) {
  switch (status) {
    case "PUBLISHED":
      return "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200";
    case "ARCHIVED":
      return "border-white/10 bg-white/[0.04] text-white/40";
    default:
      return "border-amber-300/20 bg-amber-300/[0.08] text-amber-200";
  }
}

export default function MediaLibraryGrid({ items }: MediaLibraryGridProps) {
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const activeIndex = useMemo(
    () => items.findIndex((item) => item.id === activeMediaId),
    [activeMediaId, items],
  );
  const activeMedia = activeIndex >= 0 ? items[activeIndex] : null;
  const activeExternalMedia = useMemo(
    () => tryResolveExternalMedia(activeMedia?.externalUrl),
    [activeMedia?.externalUrl],
  );

  const closePreview = useCallback(() => setActiveMediaId(null), []);
  const showPrevious = useCallback(() => {
    if (items.length === 0 || activeIndex < 0) {
      return;
    }

    setActiveMediaId(items[(activeIndex - 1 + items.length) % items.length].id);
  }, [activeIndex, items]);
  const showNext = useCallback(() => {
    if (items.length === 0 || activeIndex < 0) {
      return;
    }

    setActiveMediaId(items[(activeIndex + 1) % items.length].id);
  }, [activeIndex, items]);

  useEffect(() => {
    if (!activeMedia) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
      }

      if (event.key === "ArrowLeft" && items.length > 1) {
        showPrevious();
      }

      if (event.key === "ArrowRight" && items.length > 1) {
        showNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMedia, closePreview, items.length, showNext, showPrevious]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {items.map((item) => (
          <article
            key={item.id}
            className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20 transition duration-300 hover:border-white/[0.18] hover:shadow-[0_24px_65px_rgba(0,0,0,0.3)]"
          >
            <button
              type="button"
              onClick={() => setActiveMediaId(item.id)}
              className="relative block aspect-[4/3] w-full overflow-hidden bg-[#0d0d0e] text-left"
              aria-label={`Preview ${item.originalFilename || item.collectionLabel}`}
            >
              {item.publicUrl ? (
                <Image
                  src={item.publicUrl}
                  alt={
                    item.altText ||
                    item.originalFilename ||
                    `${item.project.title} ${item.collectionLabel}`
                  }
                  fill
                  sizes="(min-width: 1536px) 22vw, (min-width: 1280px) 30vw, (min-width: 640px) 46vw, 94vw"
                  quality={75}
                  className="h-full w-full object-cover transition duration-700 ease-[var(--ease-luxury)] group-hover:scale-[1.035]"
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(217,107,43,0.16),transparent_34%),#111]" />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/15 opacity-70 transition group-hover:opacity-90" />

              <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[0.5rem] font-semibold uppercase tracking-[0.13em] backdrop-blur-md ${
                    item.visibility === "VISIBLE"
                      ? "border-white/10 bg-black/50 text-white/55"
                      : "border-amber-300/20 bg-amber-300/10 text-amber-100/70"
                  }`}
                >
                  {item.visibility === "VISIBLE" ? "Visible" : "Hidden"}
                </span>

                {item.isHero && (
                  <span className="rounded-full border border-[var(--helios-orange)]/35 bg-[var(--helios-orange)] px-2.5 py-1 text-[0.5rem] font-semibold uppercase tracking-[0.13em] text-black">
                    Hero
                  </span>
                )}
              </div>

              <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
                <span className="max-w-[75%] truncate text-[0.55rem] font-semibold uppercase tracking-[0.15em] text-white/65">
                  {item.collectionLabel}
                </span>

                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/65 backdrop-blur-md">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4"
                  >
                    <path
                      d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </div>
            </button>

            <div className="p-4">
              <p className="truncate text-sm font-medium text-white/75">
                {item.originalFilename || "Untitled asset"}
              </p>

              <p className="mt-2 truncate text-xs text-white/30">
                {formatFileSize(item.fileSize)}
                <span className="mx-2 text-white/15">·</span>
                {formatDimensions(item)}
              </p>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
                <div className="flex min-w-0 items-center gap-2">
                  <Link
                    href={`/admin/projects/${item.project.id}#project-media`}
                    className="min-w-0 truncate text-xs text-white/40 transition hover:text-white"
                  >
                    {item.project.title}
                  </Link>

                  <Link
                    href={item.projectFilterUrl}
                    aria-label={`Show only assets from ${item.project.title}`}
                    title={`Filter by ${item.project.title}`}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.08] text-white/25 transition hover:border-white/20 hover:text-white/65"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-3 w-3"
                    >
                      <path
                        d="M4 6h16M7 12h10M10 18h4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </Link>
                </div>

                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.48rem] font-semibold uppercase tracking-[0.12em] ${statusClasses(
                    item.project.status,
                  )}`}
                >
                  {item.project.status.toLowerCase()}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {activeMedia && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${activeMedia.originalFilename || activeMedia.collectionLabel}`}
          className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-xl"
        >
          <div className="flex min-h-20 items-center justify-between gap-5 border-b border-white/[0.08] px-5 sm:px-7">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white/75">
                {activeMedia.originalFilename || "Untitled asset"}
              </p>
              <p className="mt-1 truncate text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/28">
                {activeMedia.project.title}
                <span className="mx-2">·</span>
                {activeMedia.collectionLabel}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-white/30 sm:inline">
                {activeIndex + 1} of {items.length}
              </span>

              <Link
                href={`/admin/projects/${activeMedia.project.id}#project-media`}
                className="hidden admin-btn-secondary sm:inline-flex"
              >
                Manage asset
              </Link>

              <button
                type="button"
                onClick={closePreview}
                aria-label="Close preview"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/55 transition hover:border-white/25 hover:text-white"
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
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8">
            {activeMedia.publicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeMedia.publicUrl}
                alt={
                  activeMedia.altText ||
                  activeMedia.originalFilename ||
                  `${activeMedia.project.title} ${activeMedia.collectionLabel}`
                }
                className="max-h-full max-w-full object-contain shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
              />
            ) : activeExternalMedia?.embedUrl ? (
              <iframe
                src={activeExternalMedia.embedUrl}
                title={
                  activeMedia.originalFilename ||
                  `${activeExternalMedia.label} video`
                }
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="aspect-video max-h-full w-full max-w-6xl rounded-lg border border-white/10 bg-black shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
              />
            ) : activeExternalMedia?.playbackUrl ? (
              <video
                src={activeExternalMedia.playbackUrl}
                controls
                playsInline
                preload="metadata"
                className="max-h-full w-full max-w-6xl rounded-lg bg-black shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
              >
                Your browser cannot play this hosted video.
              </video>
            ) : activeMedia.externalUrl ? (
              <a
                href={activeMedia.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="admin-btn-secondary"
              >
                Open external asset
              </a>
            ) : (
              <p className="text-sm text-white/35">
                No preview is available for this asset.
              </p>
            )}

            {items.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={showPrevious}
                  aria-label="Previous asset"
                  className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/55 backdrop-blur-md transition hover:border-white/25 hover:text-white sm:left-7"
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
                  onClick={showNext}
                  aria-label="Next asset"
                  className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/55 backdrop-blur-md transition hover:border-white/25 hover:text-white sm:right-7"
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
          </div>

          {(activeMedia.caption || activeMedia.altText) && (
            <div className="border-t border-white/[0.08] px-5 py-4 sm:px-7">
              <p className="mx-auto max-w-4xl text-center text-xs leading-5 text-white/35">
                {activeMedia.caption || activeMedia.altText}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
