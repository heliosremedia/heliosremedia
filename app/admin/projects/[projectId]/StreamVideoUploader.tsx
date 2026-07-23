"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import * as tus from "tus-js-client";

import {
  MEDIA_COLLECTIONS,
  type MediaCategory,
} from "@/lib/media-collections";

import type { ProjectMediaItem } from "./ProjectMediaManager";

const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
const ACCEPTED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "application/quicktime",
]);

type StreamVideoUploaderProps = {
  projectId: string;
  onMediaAdded: (media: ProjectMediaItem) => void;
};

type CreateMediaResponse = {
  success: boolean;
  error?: string;
  media?: ProjectMediaItem;
};

function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getStreamUid(uploadUrl: string | null | undefined) {
  if (!uploadUrl) {
    return null;
  }

  const segments = new URL(uploadUrl).pathname.split("/").filter(Boolean);
  const candidate = segments.at(-1) ?? "";
  return /^[a-f0-9]{32}$/i.test(candidate) ? candidate : null;
}

function getVideoDimensions(file: File) {
  return new Promise<{ width: number | null; height: number | null }>(
    (resolve) => {
      const video = document.createElement("video");
      const objectUrl = URL.createObjectURL(file);
      const finish = (width: number | null, height: number | null) => {
        URL.revokeObjectURL(objectUrl);
        video.removeAttribute("src");
        resolve({ width, height });
      };

      video.preload = "metadata";
      video.onloadedmetadata = () =>
        finish(video.videoWidth || null, video.videoHeight || null);
      video.onerror = () => finish(null, null);
      video.src = objectUrl;
    },
  );
}

export default function StreamVideoUploader({
  projectId,
  onMediaAdded,
}: StreamVideoUploaderProps) {
  const uploadRef = useRef<tus.Upload | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaCategory, setMediaCategory] =
    useState<MediaCategory>("AGENT_BRANDING");
  const [visibility, setVisibility] = useState<"VISIBLE" | "HIDDEN">("VISIBLE");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "saving" | "complete" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const isBusy = status === "uploading" || status === "saving";
  const statusLabel = useMemo(() => {
    if (status === "uploading") {
      return `${progress}% uploaded`;
    }
    if (status === "saving") {
      return "Adding video to project";
    }
    if (status === "complete") {
      return "Upload complete · Cloudflare is processing playback";
    }
    return null;
  }, [progress, status]);

  function validateFile(selectedFile: File) {
    const extensionSupported = /\.(mp4|mov)$/i.test(selectedFile.name);
    if (
      (!ACCEPTED_VIDEO_TYPES.has(selectedFile.type) && !extensionSupported) ||
      selectedFile.size <= 0
    ) {
      throw new Error("Choose an MP4 or MOV video.");
    }
    if (selectedFile.size > MAX_VIDEO_SIZE) {
      throw new Error("Videos must be no larger than 500 MB.");
    }
  }

  async function saveMedia(
    streamUid: string,
    selectedFile: File,
    dimensions: { width: number | null; height: number | null },
  ) {
    setStatus("saving");
    const response = await fetch(`/api/admin/projects/${projectId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        streamUid,
        originalFilename: title.trim(),
        altText,
        caption,
        visibility,
        mediaCategory,
        mimeType: selectedFile.type || "video/mp4",
        fileSize: selectedFile.size,
        width: dimensions.width,
        height: dimensions.height,
      }),
    });
    const data = (await response.json()) as CreateMediaResponse;

    if (!response.ok || !data.success || !data.media) {
      throw new Error(data.error || "The uploaded video could not be saved.");
    }

    onMediaAdded(data.media);
    setStatus("complete");
    setFile(null);
    setTitle("");
    setAltText("");
    setCaption("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!file || !title.trim()) {
      setError("Choose a video and enter its display title.");
      return;
    }

    try {
      validateFile(file);
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Choose a valid video.",
      );
      return;
    }

    const dimensions = await getVideoDimensions(file);
    setStatus("uploading");
    setProgress(0);
    const upload = new tus.Upload(file, {
      endpoint: `/api/admin/projects/${projectId}/stream-upload`,
      chunkSize: 50 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      metadata: {
        filename: file.name,
        filetype: file.type || "video/mp4",
        name: title.trim(),
      },
      removeFingerprintOnSuccess: true,
      onError(uploadError) {
        setStatus("error");
        setError(uploadError.message || "The video upload failed.");
      },
      onProgress(bytesUploaded, bytesTotal) {
        setProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess() {
        const streamUid = getStreamUid(upload.url);
        if (!streamUid) {
          setStatus("error");
          setError("Cloudflare finished the upload but did not return a video ID.");
          return;
        }

        void saveMedia(streamUid, file, dimensions).catch((saveError) => {
          setStatus("error");
          setError(
            saveError instanceof Error
              ? saveError.message
              : "The uploaded video could not be saved.",
          );
        });
      },
    });

    uploadRef.current = upload;
    void upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.035]">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-6 px-5 py-5 text-left transition hover:bg-white/[0.025] sm:px-6"
      >
        <span>
          <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.19em] text-[var(--helios-orange)]">
            Cloudflare Stream
          </span>
          <span className="mt-2 block text-xl font-normal text-white">
            Upload a portfolio video
          </span>
          <span className="mt-1.5 block text-sm leading-6 text-white/35">
            Resumable MP4 or MOV upload · up to 500 MB.
          </span>
        </span>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/45 transition ${
            isOpen ? "rotate-45 border-[var(--helios-orange)]/40 text-white" : ""
          }`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 border-t border-white/[0.08] px-5 py-6 sm:px-6 sm:py-7"
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="block">
              <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                Video file
              </span>
              <span className="mt-2.5 flex min-h-12 cursor-pointer items-center justify-between rounded-xl border border-dashed border-white/15 bg-black/25 px-4 text-sm text-white/55 transition hover:border-[var(--helios-orange)]/45">
                <span className="truncate">
                  {file ? `${file.name} · ${formatFileSize(file.size)}` : "Choose MP4 or MOV"}
                </span>
                <span className="ml-4 text-[0.52rem] font-semibold uppercase tracking-[0.13em] text-[var(--helios-orange)]">
                  Browse
                </span>
                <input
                  type="file"
                  accept=".mp4,.mov,video/mp4,video/quicktime"
                  disabled={isBusy}
                  className="sr-only"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] ?? null;
                    setError(null);
                    setStatus("idle");
                    if (!selectedFile) {
                      setFile(null);
                      return;
                    }
                    try {
                      validateFile(selectedFile);
                      setFile(selectedFile);
                      if (!title) {
                        setTitle(selectedFile.name.replace(/\.[^.]+$/, ""));
                      }
                    } catch (validationError) {
                      setFile(null);
                      setError(
                        validationError instanceof Error
                          ? validationError.message
                          : "Choose a valid video.",
                      );
                    }
                  }}
                />
              </span>
            </label>

            <label className="block">
              <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                Display title
              </span>
              <input
                type="text"
                required
                maxLength={255}
                disabled={isBusy}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Agent branding film"
                className="mt-2.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white/80 outline-none transition placeholder:text-white/20 focus:border-[var(--helios-orange)]/55 focus:ring-2 focus:ring-[var(--helios-orange)]/10"
              />
            </label>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <label className="block">
              <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                Media collection
              </span>
              <select
                value={mediaCategory}
                disabled={isBusy}
                onChange={(event) =>
                  setMediaCategory(event.target.value as MediaCategory)
                }
                className="mt-2.5 min-h-12 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm text-white/80 outline-none transition focus:border-[var(--helios-orange)]/55"
              >
                {MEDIA_COLLECTIONS.filter((collection) =>
                  [
                    "CINEMATIC_FILM",
                    "VERTICAL_REEL",
                    "AGENT_BRANDING",
                    "SOCIAL_CONTENT",
                  ].includes(collection.value),
                ).map((collection) => (
                  <option key={collection.value} value={collection.value}>
                    {collection.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                Visibility
              </span>
              <select
                value={visibility}
                disabled={isBusy}
                onChange={(event) =>
                  setVisibility(event.target.value as "VISIBLE" | "HIDDEN")
                }
                className="mt-2.5 min-h-12 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm text-white/80 outline-none transition focus:border-[var(--helios-orange)]/55"
              >
                <option value="VISIBLE">Visible</option>
                <option value="HIDDEN">Hidden</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
              Accessibility description
            </span>
            <input
              type="text"
              maxLength={500}
              disabled={isBusy}
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              placeholder="Describe the video for accessibility and search"
              className="mt-2.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white/80 outline-none transition placeholder:text-white/20 focus:border-[var(--helios-orange)]/55"
            />
          </label>

          <label className="block">
            <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
              Caption
            </span>
            <textarea
              rows={3}
              maxLength={2000}
              disabled={isBusy}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              className="mt-2.5 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white/80 outline-none transition focus:border-[var(--helios-orange)]/55"
            />
          </label>

          {isBusy && (
            <div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-[var(--helios-orange)] transition-[width]"
                  style={{ width: `${status === "saving" ? 100 : progress}%` }}
                />
              </div>
            </div>
          )}

          {(error || statusLabel) && (
            <p
              role={error ? "alert" : "status"}
              className={`text-sm ${error ? "text-red-300" : "text-white/45"}`}
            >
              {error || statusLabel}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={isBusy} className="admin-btn-primary">
              {isBusy ? "Uploading…" : "Upload to Stream"}
            </button>
            {status === "uploading" && (
              <button
                type="button"
                onClick={() => {
                  uploadRef.current?.abort();
                  setStatus("idle");
                  setProgress(0);
                }}
                className="admin-btn-secondary"
              >
                Pause upload
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
