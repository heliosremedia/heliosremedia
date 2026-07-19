"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  MEDIA_COLLECTIONS,
  type MediaCategory,
} from "@/lib/media-collections";
import { resolveExternalMedia } from "@/lib/external-media";

import type { ProjectMediaItem } from "./ProjectMediaManager";

type ExternalMediaFormProps = {
  projectId: string;
  onMediaAdded: (media: ProjectMediaItem) => void;
};

type CreateMediaResponse = {
  success: boolean;
  error?: string;
  media?: ProjectMediaItem;
};

export default function ExternalMediaForm({
  projectId,
  onMediaAdded,
}: ExternalMediaFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaCategory, setMediaCategory] =
    useState<MediaCategory>("CINEMATIC_FILM");
  const [visibility, setVisibility] = useState<"VISIBLE" | "HIDDEN">(
    "VISIBLE",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const detection = useMemo(() => {
    if (!url.trim()) {
      return { details: null, error: null };
    }

    try {
      return { details: resolveExternalMedia(url), error: null };
    } catch (resolutionError) {
      return {
        details: null,
        error:
          resolutionError instanceof Error
            ? resolutionError.message
            : "This link could not be recognized.",
      };
    }
  }, [url]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!detection.details) {
      setError(detection.error || "Enter a valid video URL.");
      return;
    }

    try {
      setIsSaving(true);

      const response = await fetch(`/api/admin/projects/${projectId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalUrl: url,
          originalFilename: title,
          altText,
          caption,
          mediaCategory,
          visibility,
        }),
      });
      const data = (await response.json()) as CreateMediaResponse;

      if (!response.ok || !data.success || !data.media) {
        throw new Error(data.error || "The video link could not be added.");
      }

      onMediaAdded(data.media);
      setSuccess(`${detection.details.label} video added to the project.`);
      setUrl("");
      setTitle("");
      setAltText("");
      setCaption("");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The video link could not be added.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => {
          setIsOpen((current) => !current);
          setError(null);
          setSuccess(null);
        }}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-6 px-5 py-5 text-left transition hover:bg-white/[0.025] sm:px-6"
      >
        <span>
          <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.19em] text-[var(--helios-orange)]">
            External video
          </span>
          <span className="mt-2 block text-xl font-normal text-white">
            Add a video link
          </span>
          <span className="mt-1.5 block text-sm leading-6 text-white/35">
            YouTube, Vimeo, Dropbox, or a direct hosted video URL.
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
          className="border-t border-white/[0.08] px-5 py-6 sm:px-6 sm:py-7"
        >
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
            <div className="space-y-5">
              <label className="block">
                <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Video URL
                </span>
                <input
                  type="url"
                  required
                  maxLength={2048}
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    setError(null);
                    setSuccess(null);
                  }}
                  placeholder="https://youtube.com/watch?v=..."
                  className="mt-2.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white/80 outline-none transition placeholder:text-white/20 focus:border-[var(--helios-orange)]/55 focus:ring-2 focus:ring-[var(--helios-orange)]/10"
                />
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                    Display title
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={255}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Property cinematic film"
                    className="mt-2.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white/80 outline-none transition placeholder:text-white/20 focus:border-[var(--helios-orange)]/55 focus:ring-2 focus:ring-[var(--helios-orange)]/10"
                  />
                </label>

                <label className="block">
                  <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                    Media collection
                  </span>
                  <select
                    value={mediaCategory}
                    onChange={(event) =>
                      setMediaCategory(event.target.value as MediaCategory)
                    }
                    className="mt-2.5 min-h-12 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm text-white/80 outline-none transition focus:border-[var(--helios-orange)]/55 focus:ring-2 focus:ring-[var(--helios-orange)]/10"
                  >
                    {MEDIA_COLLECTIONS.map((collection) => (
                      <option key={collection.value} value={collection.value}>
                        {collection.label}
                      </option>
                    ))}
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
                  value={altText}
                  onChange={(event) => setAltText(event.target.value)}
                  placeholder="Describe the video for accessibility and search"
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
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="Optional context shown with the video"
                  className="mt-2.5 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white/80 outline-none transition placeholder:text-white/20 focus:border-[var(--helios-orange)]/55 focus:ring-2 focus:ring-[var(--helios-orange)]/10"
                />
              </label>
            </div>

            <div className="space-y-5">
              <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/30">
                <div className="relative aspect-video overflow-hidden bg-[radial-gradient(circle_at_70%_20%,rgba(217,107,43,0.18),transparent_40%),#090909]">
                  {detection.details?.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={detection.details.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover opacity-70"
                    />
                  ) : null}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/25 px-6 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/75 backdrop-blur-md">
                      <svg viewBox="0 0 24 24" fill="none" className="ml-0.5 h-4 w-4" aria-hidden="true">
                        <path d="m9 7 8 5-8 5V7Z" fill="currentColor" />
                      </svg>
                    </span>
                    <span className="mt-4 text-[0.58rem] font-semibold uppercase tracking-[0.17em] text-white/55">
                      {detection.details?.label || "Waiting for link"}
                    </span>
                  </div>
                </div>
                <div className="px-4 py-4">
                  <p className="text-xs leading-5 text-white/35">
                    {detection.error
                      ? detection.error
                      : detection.details?.sourceType === "EXTERNAL_LINK"
                        ? "This URL will open as a polished external experience."
                        : detection.details
                          ? "Recognized and ready for inline playback."
                          : "Paste a supported link to validate it before publishing."}
                  </p>
                </div>
              </div>

              <fieldset>
                <legend className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Portfolio visibility
                </legend>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(["VISIBLE", "HIDDEN"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setVisibility(option)}
                      aria-pressed={visibility === option}
                      className={`min-h-11 rounded-xl border text-xs transition ${
                        visibility === option
                          ? "border-[var(--helios-orange)]/50 bg-[var(--helios-orange)]/[0.08] text-white"
                          : "border-white/[0.08] text-white/35 hover:border-white/20 hover:text-white/65"
                      }`}
                    >
                      {option === "VISIBLE" ? "Visible" : "Hidden"}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>

          {(error || success) && (
            <p
              className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
                error
                  ? "border-red-300/15 bg-red-300/[0.05] text-red-200/80"
                  : "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200/75"
              }`}
              role="status"
            >
              {error || success}
            </p>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={
                isSaving ||
                !title.trim() ||
                !detection.details ||
                Boolean(detection.error)
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--helios-orange)] px-7 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-black transition hover:bg-[var(--helios-orange-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving && (
                <span className="h-3 w-3 animate-spin rounded-full border border-black/25 border-t-black" />
              )}
              {isSaving ? "Adding video" : "Add to project"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
