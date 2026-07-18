"use client";

import { useState } from "react";
import type { PublicSiteSettings } from "@/lib/site-settings";

type HeroMediaKind = "video" | "poster";

type UploadState = {
  kind: HeroMediaKind;
  progress: number;
} | null;

type PresignResponse = {
  success: boolean;
  error?: string;
  upload?: {
    uploadUrl: string;
    publicUrl: string;
    contentType: string;
  };
};

function uploadToR2(
  file: File,
  uploadUrl: string,
  contentType: string,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error("Cloudflare R2 rejected the upload."));
      }
    });

    request.addEventListener("error", () => {
      reject(new Error("The upload connection was interrupted."));
    });

    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", contentType);
    request.send(file);
  });
}

export default function SiteSettingsForm({
  initialSettings,
}: {
  initialSettings: PublicSiteSettings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<UploadState>(null);
  const [message, setMessage] = useState<string | null>(null);

  function update(key: keyof PublicSiteSettings, value: string) {
    setSettings(
      (current) =>
        ({ ...current, [key]: value || null }) as PublicSiteSettings,
    );
  }

  async function persist(
    nextSettings: PublicSiteSettings,
    successMessage = "Global settings saved.",
  ) {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to save settings.");
      }

      setSettings(data.settings);
      setMessage(successMessage);
      return data.settings as PublicSiteSettings;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to save settings.";
      setMessage(errorMessage);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function uploadHeroMedia(kind: HeroMediaKind, file: File) {
    setUploading({ kind, progress: 0 });
    setMessage(
      kind === "video"
        ? "Preparing homepage hero video…"
        : "Preparing homepage poster…",
    );

    try {
      const response = await fetch("/api/admin/site-settings/hero-media/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });
      const data = (await response.json()) as PresignResponse;

      if (!response.ok || !data.success || !data.upload) {
        throw new Error(data.error || "Unable to prepare this upload.");
      }

      await uploadToR2(
        file,
        data.upload.uploadUrl,
        data.upload.contentType,
        (progress) => setUploading({ kind, progress }),
      );

      const key = kind === "video" ? "heroVideoUrl" : "heroPosterUrl";
      const nextSettings = {
        ...settings,
        [key]: data.upload.publicUrl,
      };

      await persist(
        nextSettings,
        kind === "video"
          ? "Homepage hero video uploaded and published."
          : "Homepage poster uploaded and published.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The homepage media could not be uploaded.",
      );
    } finally {
      setUploading(null);
    }
  }

  async function clearHeroVideo() {
    const nextSettings = { ...settings, heroVideoUrl: null };
    setSettings(nextSettings);

    try {
      await persist(nextSettings, "Homepage hero video disconnected.");
    } catch {
      setSettings(settings);
    }
  }

  const groups = [
    {
      title: "Business and contact",
      fields: [
        ["businessName", "Business name"],
        ["phoneDisplay", "Display phone"],
        ["phoneE164", "International phone"],
        ["email", "Public email"],
        ["bookingUrl", "External booking URL (optional; blank uses Helios inquiries)"],
      ],
    },
    {
      title: "Location and messaging",
      fields: [
        ["locationLabel", "Location label"],
        ["serviceArea", "Primary service area"],
        ["availabilityMessage", "Availability message"],
        ["footerDescription", "Footer description"],
        ["serviceAreaDescription", "Service-area description"],
      ],
    },
    {
      title: "Social and website",
      fields: [
        ["websiteUrl", "Public website URL"],
        ["instagramUrl", "Instagram URL"],
        ["facebookUrl", "Facebook URL"],
        ["youtubeUrl", "YouTube URL"],
        ["linkedinUrl", "LinkedIn URL"],
      ],
    },
    {
      title: "Default search metadata",
      fields: [
        ["defaultSeoTitle", "Default SEO title"],
        ["defaultSeoDescription", "Default SEO description"],
      ],
    },
  ] as const;

  const uploadBusy = uploading !== null || saving;

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111]">
        <div className="grid gap-8 border-b border-white/[0.08] p-6 lg:grid-cols-[0.8fr_1.2fr] lg:p-8">
          <div>
            <p className="text-[0.54rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">
              Homepage media
            </p>
            <h2 className="mt-3 text-2xl font-light text-white">Hero experience</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/40">
              The poster appears immediately while the cinematic background loads
              and remains in place for reduced-motion visitors or if video playback
              is unavailable.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5">
              <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                Hero video
              </p>
              <p className="mt-3 text-sm text-white/70">
                MP4 or WebM · 16:9 recommended · up to 500 MB
              </p>
              <p className="mt-2 truncate text-xs text-white/30">
                {settings.heroVideoUrl || "No video connected"}
              </p>
              {uploading?.kind === "video" ? (
                <div className="mt-5">
                  <div className="h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-[var(--helios-orange)] transition-[width]"
                      style={{ width: `${uploading.progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/40">
                    Uploading {uploading.progress}%
                  </p>
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-3">
                <label className={`cursor-pointer rounded-full bg-[var(--helios-orange)] px-5 py-3 text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-black ${uploadBusy ? "pointer-events-none opacity-40" : ""}`}>
                  {settings.heroVideoUrl ? "Replace video" : "Upload video"}
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    className="sr-only"
                    disabled={uploadBusy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadHeroMedia("video", file);
                      event.target.value = "";
                    }}
                  />
                </label>
                {settings.heroVideoUrl ? (
                  <button
                    type="button"
                    disabled={uploadBusy}
                    onClick={() => void clearHeroVideo()}
                    className="rounded-full border border-white/10 px-5 py-3 text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-white/55 disabled:opacity-40"
                  >
                    Disconnect
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5">
              <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                Poster image
              </p>
              <p className="mt-3 text-sm text-white/70">
                JPG, PNG, WebP, or AVIF · 1920×1080 recommended
              </p>
              <p className="mt-2 truncate text-xs text-white/30">
                {settings.heroPosterUrl || "No poster connected"}
              </p>
              {uploading?.kind === "poster" ? (
                <div className="mt-5">
                  <div className="h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-[var(--helios-orange)] transition-[width]"
                      style={{ width: `${uploading.progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/40">
                    Uploading {uploading.progress}%
                  </p>
                </div>
              ) : null}
              <div className="mt-5">
                <label className={`inline-flex cursor-pointer rounded-full border border-white/15 px-5 py-3 text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-white/70 ${uploadBusy ? "pointer-events-none opacity-40" : ""}`}>
                  {settings.heroPosterUrl ? "Replace poster" : "Upload poster"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="sr-only"
                    disabled={uploadBusy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadHeroMedia("poster", file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {groups.map((group) => (
          <section
            key={group.title}
            className="rounded-2xl border border-white/[0.08] bg-[#111] p-6"
          >
            <h2 className="text-xl font-light text-white">{group.title}</h2>
            <div className="mt-6 space-y-5">
              {group.fields.map(([key, label]) => (
                <label
                  key={key}
                  className="block text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35"
                >
                  {label}
                  {["footerDescription", "serviceAreaDescription", "defaultSeoDescription"].includes(key) ? (
                    <textarea
                      rows={3}
                      value={settings[key] ?? ""}
                      onChange={(event) => update(key, event.target.value)}
                      className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case leading-6 tracking-normal text-white outline-none focus:border-[var(--helios-orange)]"
                    />
                  ) : (
                    <input
                      value={settings[key] ?? ""}
                      onChange={(event) => update(key, event.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]"
                    />
                  )}
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-5 mt-6 flex items-center justify-between gap-5 rounded-2xl border border-white/10 bg-[#161616]/95 p-4 shadow-2xl backdrop-blur-xl">
        <p role="status" className="text-sm text-white/40">
          {message || "Changes apply across the public website after saving."}
        </p>
        <button
          type="button"
          onClick={() => void persist(settings)}
          disabled={saving || uploading !== null}
          className="shrink-0 rounded-full bg-[var(--helios-orange)] px-6 py-3 text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </>
  );
}
