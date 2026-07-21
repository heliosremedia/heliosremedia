"use client";

import { useState } from "react";
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
              <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Label<input value={settings.availabilityLabel ?? ""} onChange={(event) => update("availabilityLabel", event.target.value)} placeholder="Now booking" className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label><label className="text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Message or month<input value={settings.availabilityMessage ?? ""} onChange={(event) => update("availabilityMessage", event.target.value)} placeholder="August" className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label></div>
            </div>
            {([
              ["Hero", [["heroEyebrow","Eyebrow"],["heroHeadlineLineOne","Heading line 1"],["heroHeadlineLineTwo","Heading line 2"],["heroBody","Body copy"],["heroPrimaryLabel","Primary button"],["heroPrimaryDestination","Primary destination"],["heroSecondaryLabel","Secondary button"],["heroSecondaryDestination","Secondary destination"],["heroPosterAlt","Poster alt text"]]],
              ["The Helios Standard", [["standardEyebrow","Eyebrow"],["standardHeadingLineOne","Heading line 1"],["standardHeadingLineTwo","Heading line 2"],["standardBody","Body copy"]]],
              ["Our Work", [["workEyebrow","Eyebrow"],["workHeadingLineOne","Heading line 1"],["workHeadingLineTwo","Heading line 2"],["workHeadingAccent","Accent word"],["workBody","Body copy"],["workButtonLabel","Button label"],["workButtonDestination","Button destination"],["featuredProjectEyebrow","Featured project label"],["portfolioEyebrow","Portfolio kicker"],["portfolioHeading","Portfolio heading"],["portfolioButtonLabel","Portfolio button"],["portfolioButtonDestination","Portfolio destination"]]],
              ["Our Approach", [["approachEyebrow","Eyebrow"],["approachHeadingLineOne","Heading line 1"],["approachHeadingLineTwo","Heading line 2"],["approachBody","Body copy"]]],
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
