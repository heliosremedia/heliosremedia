"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tryResolveExternalMedia } from "@/lib/external-media";

export type PortfolioGalleryItem = {
  id: string;
  imageUrl: string | null;
  externalUrl: string | null;
  alt: string;
  caption: string | null;
  focalX: number;
  focalY: number;
  isWide: boolean;
};

type PortfolioGalleryProps = {
  projectTitle: string;
  collectionLabel: string;
  items: PortfolioGalleryItem[];
};

type GalleryView = "list" | "gallery" | "showcase";

export default function PortfolioGallery({
  projectTitle,
  collectionLabel,
  items,
}: PortfolioGalleryProps) {
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [galleryView, setGalleryView] = useState<GalleryView>("showcase");
  const touchStartX = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const previewItems = useMemo(
    () =>
      items.filter((item) => {
        if (item.imageUrl) {
          return true;
        }

        return (
          tryResolveExternalMedia(item.externalUrl)?.sourceType === "VIDEO_EMBED"
        );
      }),
    [items],
  );
  const [showcaseMediaId, setShowcaseMediaId] = useState<string | null>(
    previewItems[0]?.id ?? null,
  );
  const showcaseIndex = useMemo(() => {
    const selectedIndex = previewItems.findIndex(
      (item) => item.id === showcaseMediaId,
    );

    return selectedIndex >= 0 ? selectedIndex : 0;
  }, [previewItems, showcaseMediaId]);
  const showcaseMedia = previewItems[showcaseIndex] ?? null;
  const showcaseExternalMedia = useMemo(
    () => tryResolveExternalMedia(showcaseMedia?.externalUrl),
    [showcaseMedia?.externalUrl],
  );
  const activeIndex = useMemo(
    () => previewItems.findIndex((item) => item.id === activeMediaId),
    [activeMediaId, previewItems],
  );
  const activeMedia = activeIndex >= 0 ? previewItems[activeIndex] : null;

  const closePreview = useCallback(() => {
    const trigger = triggerRef.current;
    setActiveMediaId(null);
    window.requestAnimationFrame(() => trigger?.focus());
  }, []);
  const showPrevious = useCallback(() => {
    if (activeIndex < 0 || previewItems.length < 2) {
      return;
    }

    setActiveMediaId(
      previewItems[
        (activeIndex - 1 + previewItems.length) % previewItems.length
      ].id,
    );
  }, [activeIndex, previewItems]);
  const showNext = useCallback(() => {
    if (activeIndex < 0 || previewItems.length < 2) {
      return;
    }

    setActiveMediaId(previewItems[(activeIndex + 1) % previewItems.length].id);
  }, [activeIndex, previewItems]);

  useEffect(() => {
    if (!activeMedia) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
      } else if (event.key === "ArrowLeft") {
        showPrevious();
      } else if (event.key === "ArrowRight") {
        showNext();
      } else if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        );

        if (!focusable || focusable.length === 0) {
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMedia, closePreview, showNext, showPrevious]);

  return (
    <>
      <div className="mt-8 flex justify-end">
        <div
          className="inline-flex items-center rounded-xl border border-white/[0.08] bg-white/[0.025] p-1"
          role="group"
          aria-label={`${collectionLabel} gallery view`}
        >
          <button
            type="button"
            onClick={() => setGalleryView("gallery")}
            aria-label="Show compact gallery view"
            aria-pressed={galleryView === "gallery"}
            title="Gallery view"
            className={`flex h-10 w-11 items-center justify-center rounded-lg transition ${
              galleryView === "gallery"
                ? "bg-white/[0.11] text-white"
                : "text-white/35 hover:bg-white/[0.05] hover:text-white/65"
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-[1.1rem] w-[1.1rem]"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setGalleryView("list")}
            aria-label="Show full-width list view"
            aria-pressed={galleryView === "list"}
            title="List view"
            className={`flex h-10 w-11 items-center justify-center rounded-lg transition ${
              galleryView === "list"
                ? "bg-white/[0.11] text-white"
                : "text-white/35 hover:bg-white/[0.05] hover:text-white/65"
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-[1.1rem] w-[1.1rem]"
            >
              <circle cx="4.5" cy="6" r="1" fill="currentColor" />
              <circle cx="4.5" cy="12" r="1" fill="currentColor" />
              <circle cx="4.5" cy="18" r="1" fill="currentColor" />
              <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setGalleryView("showcase")}
            aria-label="Show large showcase view"
            aria-pressed={galleryView === "showcase"}
            title="Showcase view"
            className={`flex h-10 w-11 items-center justify-center rounded-lg transition ${
              galleryView === "showcase"
                ? "bg-white/[0.11] text-white"
                : "text-white/35 hover:bg-white/[0.05] hover:text-white/65"
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-[1.15rem] w-[1.15rem]"
            >
              <rect x="2.75" y="4" width="18.5" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3.5 16.5h17" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>

      {galleryView === "showcase" && showcaseMedia ? (
        <section className="mt-5" aria-label={`${collectionLabel} showcase`}>
          <div className="group relative flex h-[clamp(28rem,68vh,54rem)] items-center justify-center overflow-hidden bg-white/[0.025]">
            {showcaseMedia.imageUrl ? (
              <button
                type="button"
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setActiveMediaId(showcaseMedia.id);
                }}
                aria-label={`Open ${showcaseMedia.alt} in fullscreen`}
                className="relative flex h-full w-full cursor-zoom-in items-center justify-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={showcaseMedia.imageUrl}
                  alt={showcaseMedia.alt}
                  className="h-full w-full object-contain"
                  style={{
                    objectPosition: `${showcaseMedia.focalX * 100}% ${showcaseMedia.focalY * 100}%`,
                  }}
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
              </button>
            ) : showcaseExternalMedia?.embedUrl ? (
              <iframe
                src={showcaseExternalMedia.embedUrl}
                title={showcaseMedia.alt}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="aspect-video max-h-full w-full max-w-[96rem] border-0 bg-black"
              />
            ) : showcaseExternalMedia?.playbackUrl ? (
              <video
                src={showcaseExternalMedia.playbackUrl}
                controls
                playsInline
                preload="metadata"
                className="max-h-full w-full max-w-[96rem] bg-black"
              >
                Your browser cannot play this hosted video.
              </video>
            ) : null}

            {previewItems.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setShowcaseMediaId(
                      previewItems[
                        (showcaseIndex - 1 + previewItems.length) %
                          previewItems.length
                      ].id,
                    )
                  }
                  aria-label="Show previous asset"
                  className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/55 opacity-0 backdrop-blur-md transition hover:border-white/30 hover:text-white group-hover:opacity-100 focus:opacity-100"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setShowcaseMediaId(
                      previewItems[(showcaseIndex + 1) % previewItems.length].id,
                    )
                  }
                  aria-label="Show next asset"
                  className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/55 opacity-0 backdrop-blur-md transition hover:border-white/30 hover:text-white group-hover:opacity-100 focus:opacity-100"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </>
            )}

            <p
              aria-live="polite"
              className="absolute bottom-4 right-4 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-white/50 backdrop-blur-md"
            >
              {showcaseIndex + 1} / {previewItems.length}
            </p>
          </div>

          {showcaseMedia.caption && (
            <p className="mt-3 text-xs leading-6 text-white/35">
              {showcaseMedia.caption}
            </p>
          )}

          <div
            className="mt-3 flex gap-2 overflow-x-auto pb-3 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin]"
            aria-label={`${collectionLabel} thumbnails`}
          >
            {previewItems.map((item, itemIndex) => {
              const externalMedia = tryResolveExternalMedia(item.externalUrl);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setShowcaseMediaId(item.id)}
                  aria-label={`Show asset ${itemIndex + 1}: ${item.alt}`}
                  aria-current={item.id === showcaseMedia.id ? "true" : undefined}
                  className={`relative h-20 w-28 flex-none overflow-hidden border transition sm:h-24 sm:w-36 ${
                    item.id === showcaseMedia.id
                      ? "border-[var(--helios-orange)] opacity-100"
                      : "border-white/[0.08] opacity-45 hover:border-white/30 hover:opacity-85"
                  }`}
                >
                  {item.imageUrl || externalMedia?.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl || externalMedia!.thumbnailUrl!}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                      style={{
                        objectPosition: `${item.focalX * 100}% ${item.focalY * 100}%`,
                      }}
                    />
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_70%_20%,rgba(217,107,43,0.2),transparent_42%),#0b0b0b] text-white/55">
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                        <path d="m9 7 8 5-8 5V7Z" fill="currentColor" />
                      </svg>
                      <span className="mt-2 text-[0.48rem] font-semibold uppercase tracking-[0.12em]">
                        {externalMedia?.label || "Video"}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <div
          className={`mt-5 grid ${
            galleryView === "gallery"
              ? "grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 lg:gap-3"
              : "grid-cols-1 gap-7"
          }`}
        >
          {items.map((item) => {
            const externalMedia = tryResolveExternalMedia(item.externalUrl);

            return (
            <figure key={item.id} className="group">
              <div
                className={`relative overflow-hidden bg-white/[0.03] ${
                  galleryView === "gallery" ? "aspect-[4/3]" : "aspect-[16/10]"
                }`}
              >
                {item.imageUrl ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      triggerRef.current = event.currentTarget;
                      setActiveMediaId(item.id);
                    }}
                    aria-label={`Open ${item.alt} in fullscreen`}
                    className="relative block h-full w-full cursor-zoom-in overflow-hidden text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.alt}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-1000 ease-[var(--ease-luxury)] group-hover:scale-[1.025]"
                      style={{
                        objectPosition: `${item.focalX * 100}% ${item.focalY * 100}%`,
                      }}
                    />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
                    <span
                      className={`absolute flex translate-y-2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/65 opacity-0 backdrop-blur-md transition duration-500 group-hover:translate-y-0 group-hover:opacity-100 ${
                        galleryView === "gallery"
                          ? "bottom-3 right-3 h-9 w-9"
                          : "bottom-5 right-5 h-11 w-11"
                      }`}
                    >
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
                  </button>
                ) : externalMedia?.embedUrl ? (
                  <iframe
                    src={externalMedia.embedUrl}
                    title={item.alt}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="h-full w-full border-0 bg-black"
                  />
                ) : externalMedia?.playbackUrl ? (
                  <video
                    src={externalMedia.playbackUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-full w-full bg-black object-contain"
                  >
                    Your browser cannot play this hosted video.
                  </video>
                ) : item.externalUrl ? (
                  <a
                    href={item.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-full flex-col items-center justify-center border border-white/[0.08] px-6 text-center transition hover:border-white/20"
                  >
                    <span className="text-[0.57rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">
                      External experience
                    </span>
                    <span className="mt-4 font-display text-3xl font-light text-white/65">
                      Open {collectionLabel}
                    </span>
                    <span className="mt-6 text-xl text-white/35">↗</span>
                  </a>
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(217,107,43,0.15),transparent_35%),#111]" />
                )}
              </div>

              {item.caption && galleryView === "list" && (
                <figcaption className="mt-4 max-w-2xl text-xs leading-6 text-white/35">
                  {item.caption}
                </figcaption>
              )}
            </figure>
            );
          })}
        </div>
      )}

      {activeMedia && activeMedia.imageUrl && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${projectTitle} ${collectionLabel} fullscreen gallery`}
          className="fixed inset-0 z-[100] flex flex-col bg-black/96 backdrop-blur-xl"
        >
          <div className="flex min-h-20 items-center justify-between gap-5 border-b border-white/[0.08] px-5 sm:px-8">
            <div className="min-w-0">
              <p className="truncate text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">
                {collectionLabel}
              </p>
              <p className="mt-1 truncate font-display text-xl font-light text-white/72 sm:text-2xl">
                {projectTitle}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <p
                aria-live="polite"
                className="text-xs tabular-nums text-white/30"
              >
                {activeIndex + 1} of {previewItems.length}
              </p>
              <button
                type="button"
                autoFocus
                onClick={closePreview}
                aria-label="Close fullscreen gallery"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white/55 transition hover:border-white/30 hover:text-white"
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

          <div
            className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center p-4 sm:p-8"
            onTouchStart={(event) => {
              touchStartX.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              if (touchStartX.current === null) {
                return;
              }

              const endX = event.changedTouches[0]?.clientX;

              if (typeof endX === "number") {
                const distance = endX - touchStartX.current;

                if (distance > 55) {
                  showPrevious();
                } else if (distance < -55) {
                  showNext();
                }
              }

              touchStartX.current = null;
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={activeMedia.id}
              src={activeMedia.imageUrl}
              alt={activeMedia.alt}
              className="max-h-full max-w-full select-none object-contain shadow-[0_35px_120px_rgba(0,0,0,0.7)]"
              draggable={false}
            />

            {previewItems.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={showPrevious}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/50 backdrop-blur-md transition hover:border-white/30 hover:text-white sm:flex lg:left-7"
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
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/50 backdrop-blur-md transition hover:border-white/30 hover:text-white sm:flex lg:right-7"
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

            {previewItems.length > 1 && (
              <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-white/25 sm:hidden">
                Swipe to navigate
              </p>
            )}
          </div>

          {activeMedia.caption && (
            <div className="border-t border-white/[0.08] px-5 py-4 sm:px-8">
              <p className="mx-auto max-w-4xl text-center text-xs leading-5 text-white/38">
                {activeMedia.caption}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
