"use client";

import {
  ChangeEvent,
  DragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  DEFAULT_MEDIA_CATEGORY,
  getMediaCollection,
  MEDIA_COLLECTIONS,
  type MediaCategory,
} from "@/lib/media-collections";

type ProjectMediaItem = {
  id: string;
  storageKey: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  displayOrder: number;
  mediaCategory: MediaCategory;
  visibility: string;
  createdAt: string;
  publicUrl: string;
  isHero: boolean;
};

type MediaUploaderProps = {
  projectId: string;
  onMediaUploaded?: (media: ProjectMediaItem) => void;
};

type UploadStatus =
  | "queued"
  | "preparing"
  | "uploading"
  | "saving"
  | "complete"
  | "error";

type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: UploadStatus;
  error: string | null;
  mediaCategory: MediaCategory;
};

type PresignResponse = {
  success: boolean;
  error?: string;
  upload?: {
    key: string;
    uploadUrl: string;
    publicUrl: string;
    contentType: string;
    mediaCategory: MediaCategory;
  };
};

type MediaResponse = {
  success: boolean;
  error?: string;
  media?: ProjectMediaItem;
};

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024;

function createUploadId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function getStatusLabel(
  status: UploadStatus,
  progress: number,
) {
  switch (status) {
    case "queued":
      return "Queued";
    case "preparing":
      return "Preparing";
    case "uploading":
      return `${progress}% uploaded`;
    case "saving":
      return "Saving to project";
    case "complete":
      return "Upload complete";
    case "error":
      return "Upload failed";
  }
}

function getImageDimensions(file: File) {
  return new Promise<{
    width: number | null;
    height: number | null;
  }>((resolve) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      resolve({
        width: image.naturalWidth || null,
        height: image.naturalHeight || null,
      });

      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      resolve({
        width: null,
        height: null,
      });

      URL.revokeObjectURL(objectUrl);
    };

    image.src = objectUrl;
  });
}

function uploadFileToR2({
  file,
  uploadUrl,
  onProgress,
}: {
  file: File;
  uploadUrl: string;
  onProgress: (progress: number) => void;
}) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", file.type);

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const progress = Math.round(
        (event.loaded / event.total) * 100,
      );

      onProgress(progress);
    });

    request.addEventListener("load", () => {
      if (
        request.status >= 200 &&
        request.status < 300
      ) {
        onProgress(100);
        resolve();
        return;
      }

      reject(
        new Error(
          `Cloudflare R2 rejected the upload with status ${request.status}.`,
        ),
      );
    });

    request.addEventListener("error", () => {
      reject(
        new Error(
          "The browser could not connect to Cloudflare R2.",
        ),
      );
    });

    request.addEventListener("abort", () => {
      reject(new Error("The upload was canceled."));
    });

    request.send(file);
  });
}

export default function MediaUploader({
  projectId,
  onMediaUploaded,
}: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const collectionMenuRef = useRef<HTMLDivElement>(null);
  const collectionButtonRef =
    useRef<HTMLButtonElement>(null);

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [
    isCollectionMenuOpen,
    setIsCollectionMenuOpen,
  ] = useState(false);
  const [selectedCollection, setSelectedCollection] =
    useState<MediaCategory>(DEFAULT_MEDIA_CATEGORY);
  const [
    highlightedCollectionIndex,
    setHighlightedCollectionIndex,
  ] = useState(0);

  const activeCollection =
    getMediaCollection(selectedCollection);

  useEffect(() => {
    if (!isCollectionMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        collectionMenuRef.current &&
        !collectionMenuRef.current.contains(
          event.target as Node,
        )
      ) {
        setIsCollectionMenuOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      handlePointerDown,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );
    };
  }, [isCollectionMenuOpen]);

  const openCollectionMenu = useCallback(() => {
    const selectedIndex = MEDIA_COLLECTIONS.findIndex(
      (collection) =>
        collection.value === selectedCollection,
    );

    setHighlightedCollectionIndex(
      Math.max(selectedIndex, 0),
    );
    setIsCollectionMenuOpen(true);
  }, [selectedCollection]);

  const selectCollection = useCallback(
    (mediaCategory: MediaCategory) => {
      setSelectedCollection(mediaCategory);
      setIsCollectionMenuOpen(false);
      collectionButtonRef.current?.focus();
    },
    [],
  );

  const handleCollectionMenuKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsCollectionMenuOpen(false);
      collectionButtonRef.current?.focus();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!isCollectionMenuOpen) {
        openCollectionMenu();
        return;
      }

      setHighlightedCollectionIndex(
        (currentIndex) =>
          (currentIndex + 1) %
          MEDIA_COLLECTIONS.length,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!isCollectionMenuOpen) {
        openCollectionMenu();
        return;
      }

      setHighlightedCollectionIndex(
        (currentIndex) =>
          (currentIndex -
            1 +
            MEDIA_COLLECTIONS.length) %
          MEDIA_COLLECTIONS.length,
      );
      return;
    }

    if (
      event.key === "Home" &&
      isCollectionMenuOpen
    ) {
      event.preventDefault();
      setHighlightedCollectionIndex(0);
      return;
    }

    if (
      event.key === "End" &&
      isCollectionMenuOpen
    ) {
      event.preventDefault();
      setHighlightedCollectionIndex(
        MEDIA_COLLECTIONS.length - 1,
      );
      return;
    }

    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();

      if (!isCollectionMenuOpen) {
        openCollectionMenu();
        return;
      }

      selectCollection(
        MEDIA_COLLECTIONS[
          highlightedCollectionIndex
        ].value,
      );
    }
  };

  const updateUpload = useCallback(
    (
      id: string,
      changes:
        | Partial<UploadItem>
        | ((
            upload: UploadItem,
          ) => Partial<UploadItem>),
    ) => {
      setUploads((currentUploads) =>
        currentUploads.map((upload) => {
          if (upload.id !== id) {
            return upload;
          }

          const nextChanges =
            typeof changes === "function"
              ? changes(upload)
              : changes;

          return {
            ...upload,
            ...nextChanges,
          };
        }),
      );
    },
    [],
  );

  const uploadFile = useCallback(
    async (upload: UploadItem) => {
      try {
        updateUpload(upload.id, {
          status: "preparing",
          progress: 0,
          error: null,
        });

        const presignResponse = await fetch(
          "/api/admin/r2/presign",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              projectId,
              fileName: upload.file.name,
              fileType: upload.file.type,
              fileSize: upload.file.size,
              mediaCategory:
                upload.mediaCategory,
            }),
          },
        );

        const presignData =
          (await presignResponse.json()) as PresignResponse;

        if (
          !presignResponse.ok ||
          !presignData.success ||
          !presignData.upload
        ) {
          throw new Error(
            presignData.error ||
              "The upload could not be prepared.",
          );
        }

        updateUpload(upload.id, {
          status: "uploading",
        });

        await uploadFileToR2({
          file: upload.file,
          uploadUrl:
            presignData.upload.uploadUrl,
          onProgress: (progress) => {
            updateUpload(upload.id, {
              progress,
              status: "uploading",
            });
          },
        });

        updateUpload(upload.id, {
          status: "saving",
          progress: 100,
        });

        const dimensions =
          await getImageDimensions(upload.file);

        const mediaResponse = await fetch(
          `/api/admin/projects/${projectId}/media`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              key: presignData.upload.key,
              originalFilename:
                upload.file.name,
              mimeType: upload.file.type,
              fileSize: upload.file.size,
              width: dimensions.width,
              height: dimensions.height,
              mediaCategory:
                upload.mediaCategory,
            }),
          },
        );

        const mediaData =
          (await mediaResponse.json()) as MediaResponse;

        if (
          !mediaResponse.ok ||
          !mediaData.success ||
          !mediaData.media
        ) {
          throw new Error(
            mediaData.error ||
              "The image uploaded but could not be saved.",
          );
        }

        updateUpload(upload.id, {
          status: "complete",
          progress: 100,
          error: null,
        });

        onMediaUploaded?.(mediaData.media);
      } catch (error) {
        console.error(
          "Unable to upload project image:",
          error,
        );

        updateUpload(upload.id, {
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "The image could not be uploaded.",
        });
      }
    },
    [onMediaUploaded, projectId, updateUpload],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const nextUploads: UploadItem[] =
        files.map((file) => ({
          id: createUploadId(),
          file,
          previewUrl:
            URL.createObjectURL(file),
          progress: 0,
          status: "queued",
          error: null,
          mediaCategory:
            selectedCollection,
        }));

      setUploads((currentUploads) => [
        ...nextUploads,
        ...currentUploads,
      ]);

      for (const upload of nextUploads) {
        if (
          !ACCEPTED_IMAGE_TYPES.has(
            upload.file.type,
          )
        ) {
          updateUpload(upload.id, {
            status: "error",
            error:
              "Only JPG, PNG, WebP, and AVIF images are supported.",
          });

          continue;
        }

        if (
          upload.file.size >
          MAX_FILE_SIZE
        ) {
          updateUpload(upload.id, {
            status: "error",
            error:
              "Images must be smaller than 25 MB.",
          });

          continue;
        }

        void uploadFile(upload);
      }
    },
    [
      selectedCollection,
      updateUpload,
      uploadFile,
    ],
  );

  const handleFileInput = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(
      event.target.files ?? [],
    );

    if (files.length > 0) {
      addFiles(files);
    }

    event.target.value = "";
  };

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    setIsDragging(false);

    const files = Array.from(
      event.dataTransfer.files,
    );

    if (files.length > 0) {
      addFiles(files);
    }
  };

  const handleRetry = (
    upload: UploadItem,
  ) => {
    void uploadFile(upload);
  };

  const handleRemove = (id: string) => {
    setUploads((currentUploads) => {
      const upload =
        currentUploads.find(
          (candidate) =>
            candidate.id === id,
        );

      if (upload) {
        URL.revokeObjectURL(
          upload.previewUrl,
        );
      }

      return currentUploads.filter(
        (candidate) =>
          candidate.id !== id,
      );
    });
  };

  const clearCompletedUploads = () => {
    setUploads((currentUploads) => {
      const remainingUploads: UploadItem[] =
        [];

      for (const upload of currentUploads) {
        if (
          upload.status === "complete" ||
          upload.status === "error"
        ) {
          URL.revokeObjectURL(
            upload.previewUrl,
          );
          continue;
        }

        remainingUploads.push(upload);
      }

      return remainingUploads;
    });
  };

  const activeUploadCount =
    uploads.filter((upload) =>
      [
        "queued",
        "preparing",
        "uploading",
        "saving",
      ].includes(upload.status),
    ).length;

  const completedUploadCount =
    uploads.filter(
      (upload) =>
        upload.status === "complete",
    ).length;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,22rem)] sm:items-end">
          <div>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.19em] text-[var(--helios-orange)]">
              Media collection
            </p>

            <h3 className="mt-2 text-xl font-light tracking-[-0.02em] text-white sm:text-2xl">
              Choose where these assets belong
            </h3>

            <p className="mt-2 max-w-xl text-sm leading-6 text-white/35">
              Every upload is permanently
              assigned to its selected
              collection for organization and
              portfolio display.
            </p>
          </div>

          <div
            ref={collectionMenuRef}
            onKeyDown={
              handleCollectionMenuKeyDown
            }
            className="relative"
          >
            <button
              ref={collectionButtonRef}
              type="button"
              onClick={() => {
                if (
                  isCollectionMenuOpen
                ) {
                  setIsCollectionMenuOpen(
                    false,
                  );
                } else {
                  openCollectionMenu();
                }
              }}
              aria-haspopup="listbox"
              aria-expanded={
                isCollectionMenuOpen
              }
              aria-controls="media-collection-menu"
              className={`group flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border bg-[#111111] px-4 text-left outline-none transition duration-200 focus:ring-2 focus:ring-[var(--helios-orange)]/10 ${
                isCollectionMenuOpen
                  ? "border-[var(--helios-orange)]/60 shadow-[0_0_0_1px_rgba(255,107,0,0.12),0_18px_50px_rgba(0,0,0,0.35)]"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <span className="min-w-0">
                <span className="block text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-white/25">
                  Selected collection
                </span>

                <span className="mt-1 block truncate text-sm text-white/80">
                  {activeCollection.label}
                </span>
              </span>

              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition duration-200 ${
                  isCollectionMenuOpen
                    ? "rotate-180 border-[var(--helios-orange)]/25 bg-[var(--helios-orange)]/10 text-[var(--helios-orange)]"
                    : "border-white/[0.08] bg-white/[0.025] text-white/35 group-hover:text-white/60"
                }`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                >
                  <path
                    d="m7 9.5 5 5 5-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>

            {isCollectionMenuOpen && (
              <div
                id="media-collection-menu"
                role="listbox"
                aria-label="Media collection"
                className="absolute inset-x-0 top-[calc(100%+0.65rem)] z-40 overflow-hidden rounded-2xl border border-white/[0.12] bg-[#111111]/[0.98] p-2 shadow-[0_28px_80px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
              >
                <div className="max-h-80 space-y-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:rgba(255,255,255,0.14)_transparent] [scrollbar-width:thin]">
                  {MEDIA_COLLECTIONS.map(
                    (
                      collection,
                      index,
                    ) => {
                      const isSelected =
                        collection.value ===
                        selectedCollection;
                      const isHighlighted =
                        index ===
                        highlightedCollectionIndex;

                      return (
                        <button
                          key={
                            collection.value
                          }
                          type="button"
                          role="option"
                          aria-selected={
                            isSelected
                          }
                          tabIndex={-1}
                          onMouseEnter={() =>
                            setHighlightedCollectionIndex(
                              index,
                            )
                          }
                          onClick={() =>
                            selectCollection(
                              collection.value,
                            )
                          }
                          className={`flex min-h-12 w-full items-center justify-between gap-4 rounded-xl border px-3.5 text-left transition duration-150 ${
                            isHighlighted
                              ? "border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.08]"
                              : "border-transparent hover:bg-white/[0.035]"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span
                              className={`flex h-7 min-w-7 items-center justify-center rounded-full border px-1.5 text-[0.5rem] font-semibold tracking-[0.12em] ${
                                isSelected
                                  ? "border-[var(--helios-orange)]/30 bg-[var(--helios-orange)] text-black"
                                  : "border-white/[0.08] bg-white/[0.025] text-white/25"
                              }`}
                            >
                              {String(
                                index + 1,
                              ).padStart(
                                2,
                                "0",
                              )}
                            </span>

                            <span
                              className={`truncate text-sm ${
                                isSelected
                                  ? "text-white"
                                  : "text-white/60"
                              }`}
                            >
                              {
                                collection.label
                              }
                            </span>
                          </span>

                          {isSelected && (
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              fill="none"
                              className="h-4 w-4 shrink-0 text-[var(--helios-orange)]"
                            >
                              <path
                                d="m6 12.5 3.5 3.5L18 7.5"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </button>
                      );
                    },
                  )}
                </div>

                <div className="mt-2 border-t border-white/[0.07] px-3 py-2.5">
                  <p className="text-[0.52rem] uppercase tracking-[0.14em] text-white/20">
                    Use arrow keys to navigate
                    · Enter to select
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();

          if (
            event.currentTarget.contains(
              event.relatedTarget as Node | null,
            )
          ) {
            return;
          }

          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-2xl border border-dashed px-6 py-12 text-center transition duration-300 sm:px-10 ${
          isDragging
            ? "border-[var(--helios-orange)] bg-[var(--helios-orange)]/[0.08]"
            : "border-white/[0.12] bg-black/20 hover:border-white/25 hover:bg-white/[0.025]"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_45%)]" />

        <div className="relative mx-auto max-w-lg">
          <div
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full border transition ${
              isDragging
                ? "border-[var(--helios-orange)]/40 bg-[var(--helios-orange)]/10 text-[var(--helios-orange-hover)]"
                : "border-white/10 bg-white/[0.04] text-white/45"
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6"
            >
              <path
                d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 13.5v3.75A2.75 2.75 0 0 0 7.75 20h8.5A2.75 2.75 0 0 0 19 17.25V13.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="mt-5 text-[0.62rem] font-semibold uppercase tracking-[0.19em] text-[var(--helios-orange)]">
            {activeCollection.uploadLabel}
          </p>

          <h3 className="mt-3 text-2xl font-light tracking-[-0.02em] text-white sm:text-3xl">
            {isDragging
              ? "Drop your images here"
              : `Drag in your ${activeCollection.dropLabel}`}
          </h3>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/40">
            Upload JPG, PNG, WebP, or AVIF
            images. Each file can be up to
            25 MB.
          </p>

          <button
            type="button"
            onClick={() =>
              inputRef.current?.click()
            }
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--helios-orange)] px-7 text-[0.62rem] font-semibold uppercase tracking-[0.17em] text-black transition hover:bg-[var(--helios-orange-hover)]"
          >
            Choose images
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={handleFileInput}
            className="sr-only"
          />
        </div>
      </div>

      {uploads.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="flex flex-col gap-3 border-b border-white/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h3 className="text-lg font-normal text-white">
                Upload queue
              </h3>

              <p className="mt-1 text-xs text-white/30">
                {activeUploadCount > 0
                  ? `${activeUploadCount} currently processing`
                  : `${completedUploadCount} completed`}
              </p>
            </div>

            {activeUploadCount === 0 &&
              uploads.length > 0 && (
                <button
                  type="button"
                  onClick={
                    clearCompletedUploads
                  }
                  className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-white/30 transition hover:text-white"
                >
                  Clear completed
                </button>
              )}
          </div>

          <div className="divide-y divide-white/[0.07]">
            {uploads.map((upload) => {
              const isActive = [
                "queued",
                "preparing",
                "uploading",
                "saving",
              ].includes(upload.status);

              return (
                <article
                  key={upload.id}
                  className="grid gap-4 px-5 py-5 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center sm:px-6"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        upload.previewUrl
                      }
                      alt=""
                      className="h-full w-full object-cover"
                    />

                    {upload.status ===
                      "complete" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400 text-black">
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-4 w-4"
                          >
                            <path
                              d="m6 12.5 3.5 3.5L18 7.5"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="truncate text-sm font-medium text-white/75">
                        {upload.file.name}
                      </p>

                      <p
                        className={`shrink-0 text-[0.6rem] font-semibold uppercase tracking-[0.15em] ${
                          upload.status ===
                          "error"
                            ? "text-red-300"
                            : upload.status ===
                                "complete"
                              ? "text-emerald-300"
                              : "text-white/35"
                        }`}
                      >
                        {getStatusLabel(
                          upload.status,
                          upload.progress,
                        )}
                      </p>
                    </div>

                    <p className="mt-1 text-xs text-white/25">
                      {formatFileSize(
                        upload.file.size,
                      )}
                      <span className="mx-2 text-white/10">
                        •
                      </span>
                      <span className="text-white/35">
                        {
                          getMediaCollection(
                            upload.mediaCategory,
                          ).label
                        }
                      </span>
                    </p>

                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ${
                          upload.status ===
                          "error"
                            ? "bg-red-400"
                            : upload.status ===
                                "complete"
                              ? "bg-emerald-400"
                              : "bg-[var(--helios-orange)]"
                        }`}
                        style={{
                          width: `${
                            upload.status ===
                            "error"
                              ? 100
                              : upload.progress
                          }%`,
                        }}
                      />
                    </div>

                    {upload.error && (
                      <p className="mt-2 text-xs leading-5 text-red-300/80">
                        {upload.error}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 sm:justify-end">
                    {upload.status ===
                      "error" && (
                      <button
                        type="button"
                        onClick={() =>
                          handleRetry(
                            upload,
                          )
                        }
                        className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/10 px-4 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-white/55 transition hover:border-white/25 hover:text-white"
                      >
                        Retry
                      </button>
                    )}

                    {!isActive && (
                      <button
                        type="button"
                        onClick={() =>
                          handleRemove(
                            upload.id,
                          )
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/30 transition hover:border-red-300/30 hover:text-red-300"
                        aria-label={`Remove ${upload.file.name} from the upload queue`}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-4 w-4"
                        >
                          <path
                            d="M7 7l10 10M17 7 7 17"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}