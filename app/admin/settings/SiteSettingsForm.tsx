"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicSiteSettings } from "@/lib/site-settings";

type UploadKind = "video" | "poster" | "logo" | "monogram" | "standard" | "conversion";

type UploadState = {
  kind: UploadKind;
  progress: number;
} | null;

type PresignResponse = {
  success: boolean;
  error?: string;
  upload?: {
    key?: string;
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
  mode = "global",
}: {
  initialSettings: PublicSiteSettings;
  mode?: "global" | "homepage";
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<UploadState>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [voiceExpanded, setVoiceExpanded] = useState(false);
  const voiceCloseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!voiceExpanded) return;
    voiceCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setVoiceExpanded(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [saving, voiceExpanded]);

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

  async function uploadHeroMedia(kind: "video" | "poster", file: File) {
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

  async function uploadBrandLogo(file: File) {
    setUploading({ kind: "logo", progress: 0 });
    setMessage("Preparing managed brand logo…");

    try {
      const response = await fetch("/api/admin/site-settings/brand-logo/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
      });
      const data = (await response.json()) as PresignResponse & { upload?: PresignResponse["upload"] & { key: string } };

      if (!response.ok || !data.success || !data.upload) {
        throw new Error(data.error || "Unable to prepare this logo upload.");
      }

      await uploadToR2(file, data.upload.uploadUrl, data.upload.contentType, (progress) =>
        setUploading({ kind: "logo", progress }),
      );

      await persist(
        {
          ...settings,
          brandLogoStorageKey: data.upload.key,
          brandLogoUrl: data.upload.publicUrl,
          brandLogoAlt: settings.brandLogoAlt || settings.businessName,
        },
        "Brand logo uploaded and published across the website.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The brand logo could not be uploaded.");
    } finally {
      setUploading(null);
    }
  }

  async function clearBrandLogo() {
    const previous = settings;
    const nextSettings = { ...settings, brandLogoStorageKey: null, brandLogoUrl: null };
    setSettings(nextSettings);

    try {
      await persist(nextSettings, "Using the default Helios logo.");
    } catch {
      setSettings(previous);
    }
  }

  async function uploadBrandMonogram(file: File) {
    setUploading({ kind: "monogram", progress: 0 });
    setMessage("Preparing managed brand monogram…");

    try {
      const response = await fetch("/api/admin/site-settings/brand-monogram/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
      });
      const data = (await response.json()) as PresignResponse & { upload?: PresignResponse["upload"] & { key: string } };

      if (!response.ok || !data.success || !data.upload) {
        throw new Error(data.error || "Unable to prepare this monogram upload.");
      }

      await uploadToR2(file, data.upload.uploadUrl, data.upload.contentType, (progress) =>
        setUploading({ kind: "monogram", progress }),
      );

      await persist(
        {
          ...settings,
          brandMonogramStorageKey: data.upload.key,
          brandMonogramUrl: data.upload.publicUrl,
        },
        "Brand monogram uploaded and connected to the admin access shortcut.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The brand monogram could not be uploaded.");
    } finally {
      setUploading(null);
    }
  }

  async function clearBrandMonogram() {
    const previous = settings;
    const nextSettings = { ...settings, brandMonogramStorageKey: null, brandMonogramUrl: null };
    setSettings(nextSettings);

    try {
      await persist(nextSettings, "Using the primary-logo fallback for admin access.");
    } catch {
      setSettings(previous);
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

  async function uploadHomepageImage(kind: "standard" | "conversion", file: File) {
    setUploading({ kind, progress: 0 });
    setMessage("Preparing homepage section image…");

    try {
      const response = await fetch("/api/admin/site-settings/homepage-images/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: kind === "standard" ? "helios-standard" : "primary-conversion",
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });
      const data = (await response.json()) as PresignResponse;
      if (!response.ok || !data.success || !data.upload?.key) {
        throw new Error(data.error || "Unable to prepare this image upload.");
      }

      await uploadToR2(file, data.upload.uploadUrl, data.upload.contentType, (progress) =>
        setUploading({ kind, progress }),
      );

      const nextSettings = kind === "standard"
        ? { ...settings, heliosStandardImageStorageKey: data.upload.key, heliosStandardImageUrl: data.upload.publicUrl }
        : { ...settings, primaryConversionImageStorageKey: data.upload.key, primaryConversionImageUrl: data.upload.publicUrl };
      await persist(nextSettings, kind === "standard" ? "Helios Standard image published." : "Homepage call-to-action image published.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The homepage image could not be uploaded.");
    } finally {
      setUploading(null);
    }
  }

  async function clearHomepageImage(kind: "standard" | "conversion") {
    const previous = settings;
    const nextSettings = kind === "standard"
      ? { ...settings, heliosStandardImageStorageKey: null, heliosStandardImageUrl: null }
      : { ...settings, primaryConversionImageStorageKey: null, primaryConversionImageUrl: null };
    setSettings(nextSettings);
    try {
      await persist(nextSettings, "Using the original homepage image.");
    } catch {
      setSettings(previous);
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
        ["serviceAreaDescription", "Footer service-area line"],
      ],
    },
    {
      title: "Social and website",
      fields: [
        ["websiteUrl", "Public website address"],
        ["instagramUrl", "Instagram handle or URL"],
        ["facebookUrl", "Facebook handle or URL"],
        ["youtubeUrl", "YouTube handle or URL"],
        ["linkedinUrl", "LinkedIn handle or URL"],
      ],
    },
  ] as const;

  const uploadBusy = uploading !== null || saving;
  const bookingDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);
  const bookingOnline = settings.bookingMode === "ONLINE";
  const bookingPill = settings.bookingMode === "ONLINE"
    ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200"
    : settings.bookingMode === "UNAVAILABLE"
      ? "border-red-400/30 bg-red-400/[0.08] text-red-200"
      : "border-amber-300/30 bg-amber-300/[0.08] text-amber-100";
  const bookingLabel = settings.bookingMode === "ONLINE" ? "Online" : settings.bookingMode === "UNAVAILABLE" ? "Temporarily Unavailable" : "Booking Paused";

  return (
    <div>
      {mode === "homepage" ? (
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
                <label className={`admin-btn-primary cursor-pointer ${uploadBusy ? "pointer-events-none opacity-40" : ""}`}>
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
                    className="admin-btn-secondary"
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
                <label className={`admin-btn-secondary cursor-pointer ${uploadBusy ? "pointer-events-none opacity-40" : ""}`}>
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


      <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#111] p-6 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-[0.54rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">Homepage copy</p>
            <h2 className="mt-3 text-2xl font-light text-white">Public section content</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/40">Edit homepage-only headlines, labels, links, captions, and availability language. Empty fields fall back to the current production copy.</p>
          </div>
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">Availability message</p><p className="mt-2 text-xs leading-5 text-white/35">Preview: {settings.availabilityEnabled && settings.availabilityMessage ? `${settings.availabilityLabel ? `${settings.availabilityLabel}: ` : ""}${settings.availabilityMessage}` : "Hidden"}</p></div><label className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-white/55"><input type="checkbox" checked={settings.availabilityEnabled} onChange={(event) => setSettings((current) => ({ ...current, availabilityEnabled: event.target.checked }))} /> Enabled</label></div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Status<select value={settings.availabilityStatus} onChange={(event) => setSettings((current) => ({ ...current, availabilityStatus: event.target.value as PublicSiteSettings["availabilityStatus"] }))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]"><option value="AVAILABLE">Available · green</option><option value="ADVISORY">Advisory · amber</option><option value="CRITICAL">Critical · red</option></select></label><label className="text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Label<input value={settings.availabilityLabel ?? ""} onChange={(event) => update("availabilityLabel", event.target.value)} placeholder="Now booking" className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label><label className="text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Message or month<input value={settings.availabilityMessage ?? ""} onChange={(event) => update("availabilityMessage", event.target.value)} placeholder="August" className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label></div>
            </div>
            {([
              ["Hero", [["heroEyebrow","Eyebrow"],["heroHeadlineLineOne","Heading line 1"],["heroHeadlineLineTwo","Heading line 2"],["heroBody","Body copy"],["heroPrimaryLabel","Primary button"],["heroPrimaryDestination","Primary destination"],["heroSecondaryLabel","Secondary button"],["heroSecondaryDestination","Secondary destination"],["heroPosterAlt","Poster alt text"]]],
              ["Our Standard", [["standardEyebrow","Eyebrow"],["standardHeading","Headline"],["standardHeadingAccent","Accent"],["standardBody","Body copy"]]],
              ["Our Work", [["workEyebrow","Eyebrow"],["workHeading","Headline"],["workHeadingAccent","Accent"],["workBody","Body copy"],["workButtonLabel","Button label"],["workButtonDestination","Button destination"],["featuredProjectEyebrow","Featured project label"],["portfolioEyebrow","Portfolio kicker"],["portfolioHeading","Portfolio heading"],["portfolioButtonLabel","Portfolio button"],["portfolioButtonDestination","Portfolio destination"]]],
              ["Our Approach", [["approachEyebrow","Eyebrow"],["approachHeading","Headline"],["approachHeadingAccent","Accent"],["approachBody","Body copy"],["approachTagline","Tagline"],["approachButtonLabel","Button label"],["approachButtonDestination","Button destination"]]],
              ["Pre-footer image", [["conversionImageCaption","Image caption"]]],
            ] as const).map(([title, fields]) => <div key={title} className="rounded-2xl border border-white/[0.08] bg-black/25 p-5"><h3 className="text-lg font-light text-white">{title}</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{fields.map(([key,label]) => <label key={key} className="text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">{label}{key.toLowerCase().includes("body") ? <textarea rows={3} value={settings[key] ?? ""} onChange={(event) => update(key, event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case leading-6 tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /> : <input value={settings[key] ?? ""} onChange={(event) => update(key, event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" />}</label>)}</div></div>)}
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111]">
        <div className="grid gap-8 p-6 lg:grid-cols-[0.8fr_1.2fr] lg:p-8">
          <div>
            <p className="text-[0.54rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">Homepage imagery</p>
            <h2 className="mt-3 text-2xl font-light text-white">Section images</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/40">Replace the editorial image in The Helios Standard and the image above the footer at any time.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {([
              { kind: "standard" as const, title: "The Helios Standard", src: settings.heliosStandardImageUrl || "/standard/standard-8.jpg", altKey: "heliosStandardImageAlt" as const, managed: settings.heliosStandardImageUrl },
              { kind: "conversion" as const, title: "Pre-footer call to action", src: settings.primaryConversionImageUrl || "/standard/standard-16.jpg", altKey: "primaryConversionImageAlt" as const, managed: settings.primaryConversionImageUrl },
            ]).map((item) => (
              <div key={item.kind} className="rounded-2xl border border-white/[0.08] bg-black/25 p-5">
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">{item.title}</p>
                <div className="mt-4 aspect-video overflow-hidden rounded-xl border border-white/[0.06] bg-black/35">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.src} alt="" className="h-full w-full object-cover" />
                </div>
                <label className="mt-4 block text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Image alt text
                  <input value={settings[item.altKey] ?? ""} onChange={(event) => update(item.altKey, event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" />
                </label>
                {uploading?.kind === item.kind ? <div className="mt-4"><div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[var(--helios-orange)] transition-[width]" style={{ width: `${uploading.progress}%` }} /></div><p className="mt-2 text-xs text-white/40">Uploading {uploading.progress}%</p></div> : null}
                <div className="mt-5 flex flex-wrap gap-3">
                  <label className={`admin-btn-primary cursor-pointer ${uploadBusy ? "pointer-events-none opacity-40" : ""}`}>
                    {item.managed ? "Replace image" : "Upload image"}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={uploadBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadHomepageImage(item.kind, file); event.target.value = ""; }} />
                  </label>
                  {item.managed ? <button type="button" disabled={uploadBusy} onClick={() => void clearHomepageImage(item.kind)} className="admin-btn-secondary">Use original</button> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

        </>
      ) : null}

      {mode === "global" ? (
        <>

      <section className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111]">
        <div className="grid gap-8 p-6 lg:grid-cols-[0.8fr_1.2fr] lg:p-8">
          <div>
            <p className="text-[0.54rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">Brand identity</p>
            <h2 className="mt-3 text-2xl font-light text-white">Website logo and monogram</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/40">The primary logo powers public brand lockups. The separate square monogram creates a discreet admin-access shortcut today and is ready for future app icons and tenant branding.</p>
          </div>

          <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5">
            <p className="mb-4 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">Primary website logo</p>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-h-28 flex-1 items-center justify-center rounded-xl border border-white/[0.06] bg-black/35 p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.brandLogoUrl || "/brand/helios-logo.png"} alt={settings.brandLogoAlt || settings.businessName} className="max-h-20 w-auto max-w-full object-contain" />
              </div>
              <div className="sm:w-64">
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">Recommended file</p>
                <p className="mt-3 text-sm leading-6 text-white/70">Transparent PNG, WebP, or AVIF · at least 800 px wide · under 10 MB</p>
                {uploading?.kind === "logo" ? <div className="mt-4"><div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[var(--helios-orange)] transition-[width]" style={{ width: `${uploading.progress}%` }} /></div><p className="mt-2 text-xs text-white/40">Uploading {uploading.progress}%</p></div> : null}
              </div>
            </div>

            <label className="mt-5 block text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Logo alt text<input value={settings.brandLogoAlt ?? ""} onChange={(event) => update("brandLogoAlt", event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>

            <div className="mt-5 flex flex-wrap gap-3">
              <label className={`admin-btn-primary cursor-pointer ${uploadBusy ? "pointer-events-none opacity-40" : ""}`}>{settings.brandLogoUrl ? "Replace logo" : "Upload logo"}<input type="file" accept="image/png,image/webp,image/avif" className="sr-only" disabled={uploadBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadBrandLogo(file); event.target.value = ""; }} /></label>
              {settings.brandLogoUrl ? <button type="button" disabled={uploadBusy} onClick={() => void clearBrandLogo()} className="admin-btn-secondary">Use default</button> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-h-32 flex-1 items-center justify-center rounded-xl border border-white/[0.06] bg-black/35 p-6">
                <span className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#0b0b0b] p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.brandMonogramUrl || settings.brandLogoUrl || "/brand/helios-logo.png"}
                    alt="Brand monogram preview"
                    className={settings.brandMonogramUrl ? "h-full w-full object-contain" : "absolute left-0 top-1/2 h-16 w-auto max-w-none -translate-y-1/2"}
                  />
                </span>
              </div>
              <div className="sm:w-64">
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">Brand monogram</p>
                <p className="mt-3 text-sm leading-6 text-white/70">Transparent square PNG, WebP, or AVIF · 512 × 512 px recommended · under 5 MB</p>
                <p className="mt-2 text-xs leading-5 text-white/35">When empty, Helios crops the mark from the primary logo automatically.</p>
                {uploading?.kind === "monogram" ? <div className="mt-4"><div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[var(--helios-orange)] transition-[width]" style={{ width: `${uploading.progress}%` }} /></div><p className="mt-2 text-xs text-white/40">Uploading {uploading.progress}%</p></div> : null}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <label className={`admin-btn-primary cursor-pointer ${uploadBusy ? "pointer-events-none opacity-40" : ""}`}>{settings.brandMonogramUrl ? "Replace monogram" : "Upload monogram"}<input type="file" accept="image/png,image/webp,image/avif" className="sr-only" disabled={uploadBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadBrandMonogram(file); event.target.value = ""; }} /></label>
              {settings.brandMonogramUrl ? <button type="button" disabled={uploadBusy} onClick={() => void clearBrandMonogram()} className="admin-btn-secondary">Use logo fallback</button> : null}
            </div>
          </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#111] p-6"><p className="eyebrow text-[var(--helios-orange)]">Booking & availability</p><h2 className="mt-2 text-2xl font-light text-white">Secure booking handoff</h2><p className="mt-2 text-sm text-white/38">Business identity and contact details inherit from Business & Contact unless an override is entered.</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="flex items-center gap-3 text-sm text-white/50"><input type="checkbox" checked={settings.bookingHandoffEnabled} onChange={e=>setSettings(current=>({...current,bookingHandoffEnabled:e.target.checked}))}/>Enable handoff page</label><label className="text-xs uppercase tracking-[.14em] text-white/35">Provider name<input value={settings.bookingProviderName||""} onChange={e=>update("bookingProviderName",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white"/></label><label className="text-xs uppercase tracking-[.14em] text-white/35">Eyebrow<input value={settings.bookingEyebrow||""} onChange={e=>update("bookingEyebrow",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white"/></label><label className="text-xs uppercase tracking-[.14em] text-white/35">Primary button label<input value={settings.bookingPrimaryLabel||""} onChange={e=>update("bookingPrimaryLabel",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white"/></label><label className="text-xs uppercase tracking-[.14em] text-white/35">Call button label<input value={settings.bookingCallLabel||""} onChange={e=>update("bookingCallLabel",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white"/></label><label className="text-xs uppercase tracking-[.14em] text-white/35">Email button label<input value={settings.bookingEmailLabel||""} onChange={e=>update("bookingEmailLabel",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white"/></label><label className="flex items-center gap-3 text-sm text-white/50"><input type="checkbox" checked={settings.bookingPhoneVisible} onChange={e=>setSettings(current=>({...current,bookingPhoneVisible:e.target.checked}))}/>Show phone action</label><label className="flex items-center gap-3 text-sm text-white/50"><input type="checkbox" checked={settings.bookingEmailVisible} onChange={e=>setSettings(current=>({...current,bookingEmailVisible:e.target.checked}))}/>Show email action</label></div></section>

      <section className={`mt-6 rounded-2xl border p-6 ${settings.bookingMode === "ONLINE" ? "border-white/[0.08] bg-[#111]" : "border-[var(--helios-orange)]/45 bg-[var(--helios-orange)]/[0.045]"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">Global control</p><h2 className="mt-2 text-2xl font-light text-white">Booking availability</h2><p className="mt-2 text-sm text-white/38">Every public booking action follows the saved workspace configuration.</p></div><div className="flex flex-col items-end gap-2"><span className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[.12em] ${bookingPill}`}>{bookingLabel}</span>{bookingDirty&&<span className="text-xs text-amber-200">Unsaved changes</span>}</div></div>
        {bookingOnline&&<p className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-4 text-sm text-white/35">Outage messaging remains saved but only becomes publicly active when booking is Temporarily Unavailable or Paused.</p>}
        <div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="text-xs uppercase tracking-[.14em] text-white/35">Booking mode<select value={settings.bookingMode} onChange={(event) => setSettings(current => ({ ...current, bookingMode: event.target.value as PublicSiteSettings["bookingMode"] }))} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm normal-case tracking-normal text-white"><option value="ONLINE">Online</option><option value="UNAVAILABLE">Temporarily Unavailable</option><option value="PAUSED">Booking Paused</option></select></label><label className="text-xs uppercase tracking-[.14em] text-white/35">External booking destination<input value={settings.bookingUrl ?? ""} onChange={(e) => update("bookingUrl", e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white" /></label><label className="text-xs uppercase tracking-[.14em] text-white/35">Public headline<input value={settings.bookingHeadline ?? ""} onChange={(e) => update("bookingHeadline", e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white" /></label><label className="text-xs uppercase tracking-[.14em] text-white/35">Estimated restoration<input type="datetime-local" value={settings.bookingEstimatedRestoreAt ? new Date(settings.bookingEstimatedRestoreAt).toISOString().slice(0,16) : ""} onChange={(e) => setSettings(current => ({ ...current, bookingEstimatedRestoreAt: e.target.value ? new Date(e.target.value).toISOString() : null }))} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white" /></label><label className="text-xs uppercase tracking-[.14em] text-white/35 sm:col-span-2">Public explanation<textarea rows={4} value={settings.bookingExplanation ?? ""} onChange={(e) => update("bookingExplanation", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 p-4 text-sm normal-case leading-6 tracking-normal text-white" /></label><label className="text-xs uppercase tracking-[.14em] text-white/35">Contact phone<input value={settings.bookingContactPhone ?? ""} onChange={(e) => update("bookingContactPhone", e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white" /></label><label className="text-xs uppercase tracking-[.14em] text-white/35">Contact email<input value={settings.bookingContactEmail ?? ""} onChange={(e) => update("bookingContactEmail", e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white" /></label><label className="text-xs uppercase tracking-[.14em] text-white/35 sm:col-span-2">Banner message<input value={settings.bookingBannerMessage ?? ""} onChange={(e) => update("bookingBannerMessage", e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white" /></label><label className="flex items-center gap-3 text-sm text-white/50"><input type="checkbox" checked={settings.bookingBannerEnabled} onChange={(e) => setSettings(current => ({ ...current, bookingBannerEnabled: e.target.checked }))} className="accent-[var(--helios-orange)]" />Show public status banner</label><label className="flex items-center gap-3 text-sm text-white/50"><input type="checkbox" checked={settings.bookingRequestEnabled} onChange={(e) => setSettings(current => ({ ...current, bookingRequestEnabled: e.target.checked }))} className="accent-[var(--helios-orange)]" />Enable booking-request form</label></div>
        <div className="mt-6 rounded-xl border border-white/10 bg-black/25 p-5"><p className="text-[.52rem] uppercase tracking-[.14em] text-white/30">Unavailable-state preview</p><p className="mt-3 text-xl font-light text-white">{settings.bookingHeadline}</p><p className="mt-2 text-sm leading-6 text-white/40">{settings.bookingExplanation}</p></div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#111] p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-light text-white">Blog Studio Voice</h2><p className="mt-2 text-sm text-white/35">Long-form guidance used by the existing Blog Studio AI workflow.</p></div><button type="button" onClick={() => setVoiceExpanded(true)} className="admin-btn-secondary">Expand Editor</button></div><div className="mt-6 grid gap-5 lg:grid-cols-3">{([["brandVoice","Brand voice"],["brandAudience","Primary audience"],["brandWritingGuidance","Writing guardrails"]] as const).map(([key,label]) => <label key={key} className="text-xs uppercase tracking-[.14em] text-white/35">{label}<textarea rows={7} value={settings[key] ?? ""} onChange={(e) => update(key,e.target.value)} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 p-4 text-sm font-normal normal-case leading-6 tracking-normal text-white" /></label>)}</div><label className="mt-5 block text-xs uppercase tracking-[.14em] text-white/35">Default article author<input value={settings.defaultBlogAuthor ?? ""} onChange={(e) => update("defaultBlogAuthor",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm font-normal normal-case tracking-normal text-white" /></label></section>
      {voiceExpanded && <div role="dialog" aria-modal="true" aria-labelledby="voice-editor-title" aria-describedby="voice-editor-description" className="fixed inset-0 z-[100] overflow-y-auto bg-black/85 p-4 backdrop-blur"><div className="mx-auto my-4 min-h-[calc(100vh-2rem)] max-w-6xl rounded-2xl border border-white/10 bg-[#111] p-6 sm:p-8"><div className="flex justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">Blog Studio</p><h2 id="voice-editor-title" className="mt-2 text-3xl font-light text-white">Voice Editor</h2><p id="voice-editor-description" className="mt-2 text-sm text-white/35">Changes remain available in the standard editor until you save settings.</p></div><button ref={voiceCloseRef} onClick={() => setVoiceExpanded(false)} className="admin-btn-secondary">Close</button></div><div className="mt-8 grid gap-6">{([["brandVoice","Brand voice"],["brandAudience","Primary audience"],["brandWritingGuidance","Writing guardrails"]] as const).map(([key,label]) => <label key={key} className="text-xs uppercase tracking-[.14em] text-white/35">{label}<textarea rows={8} value={settings[key] ?? ""} onChange={(e) => update(key,e.target.value)} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 p-5 text-base font-normal normal-case leading-7 tracking-normal text-white" /></label>)}</div><div className="mt-8 flex justify-end gap-3"><button onClick={() => setVoiceExpanded(false)} className="admin-btn-secondary">Keep editing later</button><button disabled={saving} onClick={async () => { await persist(settings, "Blog Studio Voice saved."); setVoiceExpanded(false); }} className="admin-btn-primary">{saving ? "Saving…" : "Save Settings"}</button></div></div></div>}

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

      <section className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111] p-6 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-[0.54rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">Search appearance</p>
            <h2 className="mt-3 text-2xl font-light text-white">Homepage SEO preview</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/40">These defaults control the homepage search result and provide fallback metadata wherever a page does not have its own title or description.</p>
            <div className="mt-6 rounded-xl border border-white/[0.08] bg-black/25 p-5">
              <p className="truncate text-xs text-white/45">{settings.websiteUrl || "https://www.heliosrealestatemedia.com"}</p>
              <p className="mt-2 font-sans text-xl font-normal leading-7 text-[#8ab4f8]">{settings.defaultSeoTitle || "Helios Real Estate Media"}</p>
              <p className="mt-1 text-sm leading-6 text-white/52">{settings.defaultSeoDescription || "Add a concise description of Helios and the Northern Colorado services you provide."}</p>
            </div>
          </div>
          <div className="space-y-5">
            <label className="block text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Default SEO title <span className={settings.defaultSeoTitle.length > 60 ? "float-right text-amber-300/75" : "float-right text-white/25"}>{settings.defaultSeoTitle.length}/60</span><input value={settings.defaultSeoTitle} maxLength={160} onChange={(event) => update("defaultSeoTitle", event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>
            <label className="block text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Default SEO description <span className={settings.defaultSeoDescription.length > 160 ? "float-right text-amber-300/75" : "float-right text-white/25"}>{settings.defaultSeoDescription.length}/160</span><textarea rows={4} value={settings.defaultSeoDescription} maxLength={320} onChange={(event) => update("defaultSeoDescription", event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case leading-6 tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>
            <p className="text-xs leading-5 text-white/28">Aim for roughly 50–60 characters in the title and 140–160 in the description. Write naturally for people; search engines may rewrite either field.</p>
          </div>
        </div>
      </section>
        </>
      ) : null}

      <div className="sticky bottom-5 mt-6 flex items-center justify-between gap-5 rounded-2xl border border-white/10 bg-[#161616]/95 p-4 shadow-2xl backdrop-blur-xl">
        <p role="status" className="text-sm text-white/40">
          {message ||
            (mode === "homepage"
              ? "Homepage media changes apply after saving."
              : "Changes apply across the public website after saving.")}
        </p>
        <button
          type="button"
          onClick={() => void persist(settings)}
          disabled={saving || uploading !== null}
          className="shrink-0 admin-btn-primary"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
