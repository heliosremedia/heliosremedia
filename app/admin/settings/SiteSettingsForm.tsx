"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PublicSiteSettings } from "@/lib/site-settings";
import { AdminCardToggle } from "@/app/admin/components/AdminCardControls";

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
  brandIdentityAddon,
  legalAddon,
}: {
  initialSettings: PublicSiteSettings;
  mode?: "global" | "homepage";
  brandIdentityAddon?: ReactNode;
  legalAddon?: ReactNode;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<UploadState>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [voiceExpanded, setVoiceExpanded] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<"video" | "poster" | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "brand-identity": true,
    "brand-assets": false,
    "booking-experience": false,
    "global-controls": false,
    "content-discovery": false,
    "search-appearance": false,
    "legal-privacy": false,
  });
  const voiceCloseRef = useRef<HTMLButtonElement>(null);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!mediaPreview) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMediaPreview(null);
    };
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("keydown", close);
      previewTriggerRef.current?.focus();
    };
  }, [mediaPreview]);
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

  function revealAndScroll(sectionId: string) {
    setExpandedSections((current) => ({ ...current, [sectionId]: true }));
    window.requestAnimationFrame(() => window.requestAnimationFrame(() =>
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" })));
  }

  function revealInvalidParent(event: React.InvalidEvent<HTMLDivElement>) {
    const section = (event.target as HTMLElement).closest<HTMLElement>("[data-settings-section]");
    if (section?.id) {
      setExpandedSections((current) => ({ ...current, [section.id]: true }));
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        (event.target as HTMLElement).scrollIntoView({ block: "center" });
        (event.target as HTMLElement).focus({ preventScroll: true });
      }));
    }
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
      setSavedSettings(data.settings);
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
      eyebrow: "Business Information",
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
      eyebrow: "Location Information",
      title: "Location and public messaging",
      fields: [
        ["locationLabel", "Location label"],
        ["serviceArea", "Primary service area"],
        ["footerDescription", "Footer description"],
        ["serviceAreaDescription", "Footer service-area line"],
      ],
    },
    {
      eyebrow: "Website & Social Links",
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
  const bookingDirty = dirty;
  const bookingOnline = settings.bookingMode === "ONLINE";
  const bookingPill = settings.bookingMode === "ONLINE"
    ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200"
    : settings.bookingMode === "UNAVAILABLE"
      ? "border-red-400/30 bg-red-400/[0.08] text-red-200"
      : "border-amber-300/30 bg-amber-300/[0.08] text-amber-100";
  const bookingLabel = settings.bookingMode === "ONLINE" ? "Online" : settings.bookingMode === "UNAVAILABLE" ? "Temporarily Unavailable" : "Booking Paused";
  const settingsSections = [
    ["brand-identity", "Brand Identity"],
    ["brand-assets", "Brand Assets"],
    ["booking-experience", "Booking Experience"],
    ["global-controls", "Global Controls"],
    ["content-discovery", "Content & Discovery"],
    ["search-appearance", "Search Appearance"],
    ["legal-privacy", "Legal & Privacy"],
  ] as const;
  const allSettingsExpanded = settingsSections.every(([id]) => expandedSections[id]);
  const allSettingsCollapsed = settingsSections.every(([id]) => !expandedSections[id]);
  function toggleSettingsSection(id: string) {
    setExpandedSections((current) => ({ ...current, [id]: !current[id] }));
  }
  const globalIdentityCards = <div id="business-contact" className="mt-6 grid scroll-mt-28 gap-6 xl:grid-cols-2">
    {groups.map((group) => (
      <section
        id={group.title === "Business and contact" ? "business-contact-card" : group.title.startsWith("Location") ? "location-messaging" : "social-website"}
        key={group.title}
        className={`scroll-mt-28 rounded-2xl border border-white/[0.08] bg-[#111] p-6 ${group.title === "Social and website" ? "xl:col-span-2" : ""}`}
      >
        <p className="eyebrow text-[var(--helios-orange)]">{group.eyebrow}</p>
        <h2 className="mt-2 text-xl font-light text-white">{group.title}</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {group.fields.map(([key, label]) => (
            <label key={key} className={`block text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35 ${["footerDescription", "serviceAreaDescription"].includes(key) ? "sm:col-span-2" : ""}`}>
              {label}
              {["footerDescription", "serviceAreaDescription"].includes(key) ? (
                <textarea rows={3} value={settings[key] ?? ""} onChange={(event) => update(key, event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case leading-6 tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" />
              ) : (
                <input value={settings[key] ?? ""} onChange={(event) => update(key, event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" />
              )}
            </label>
          ))}
        </div>
      </section>
    ))}
  </div>;

  return (
    <div onInvalid={revealInvalidParent}>
      {mode === "homepage" ? (
        <>
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111] p-6 lg:p-8">
        <div>
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

          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5">
              <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                Hero video
              </p>
              <p className="mt-3 text-sm text-white/70">
                MP4 or WebM · 16:9 recommended · up to 500 MB
              </p>
              <div className="relative mt-4 aspect-video overflow-hidden rounded-xl border border-white/[0.08] bg-black">
                {mediaPreview === "video" ? <video src={settings.heroVideoUrl || undefined} poster={settings.heroPosterUrl || undefined} controls muted playsInline loop autoPlay className="h-full w-full object-cover" /> : <button type="button" disabled={!settings.heroVideoUrl} onClick={(event) => { previewTriggerRef.current = event.currentTarget; setMediaPreview("video"); }} className="relative h-full w-full disabled:cursor-default">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {settings.heroPosterUrl ? <img src={settings.heroPosterUrl} alt="" className="h-full w-full object-cover opacity-75" /> : <span className="flex h-full items-center justify-center text-sm text-white/25">No preview available</span>}
                  {settings.heroVideoUrl&&<span className="absolute inset-0 flex items-center justify-center"><span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-black/65 text-xl text-white" aria-hidden="true">▶</span><span className="sr-only">Play hero video preview</span></span>}
                </button>}
              </div>
              <p className="mt-3 truncate text-xs text-white/30" title={settings.heroVideoUrl || undefined}>
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
                {settings.heroVideoUrl ? mediaPreview === "video" ? <button type="button" onClick={()=>setMediaPreview(null)} className="admin-btn-secondary">Stop preview</button> : <button type="button" ref={(node) => { if (node) previewTriggerRef.current = node; }} onClick={(event) => { previewTriggerRef.current = event.currentTarget; setMediaPreview("video"); }} className="admin-btn-secondary">Preview inline</button> : null}
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
              <div className="mt-4 aspect-video overflow-hidden rounded-xl border border-white/[0.08] bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {settings.heroPosterUrl ? <img src={settings.heroPosterUrl} alt={settings.heroPosterAlt || "Current homepage poster"} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-white/25">No poster connected</div>}
              </div>
              <p className="mt-3 truncate text-xs text-white/30" title={settings.heroPosterUrl || undefined}>
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
              <div className="mt-5 flex flex-wrap gap-3">
                {settings.heroPosterUrl ? <button type="button" onClick={(event) => { previewTriggerRef.current = event.currentTarget; setMediaPreview("poster"); }} className="admin-btn-secondary">Full preview</button> : null}
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
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div><p className="text-[0.54rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">Availability message</p><h2 className="mt-3 text-2xl font-light text-white">Public availability</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Shown as the homepage availability signal. Global booking availability remains the authoritative control for whether booking actions are online.</p></div>
          <label className="inline-flex min-h-11 items-center gap-3 text-xs uppercase tracking-[0.14em] text-white/55"><input type="checkbox" checked={settings.availabilityEnabled} onChange={(event) => setSettings((current) => ({ ...current, availabilityEnabled: event.target.checked }))} /> Enabled</label>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3"><label className="text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Status<select value={settings.availabilityStatus} onChange={(event) => setSettings((current) => ({ ...current, availabilityStatus: event.target.value as PublicSiteSettings["availabilityStatus"] }))} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]"><option value="AVAILABLE">Available · green</option><option value="ADVISORY">Advisory · amber</option><option value="CRITICAL">Critical · red</option></select></label><label className="text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Label<input value={settings.availabilityLabel ?? ""} onChange={(event) => update("availabilityLabel", event.target.value)} placeholder="Now booking" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label><label className="text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Message or month<input value={settings.availabilityMessage ?? ""} onChange={(event) => update("availabilityMessage", event.target.value)} placeholder="August" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label></div>
        <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/25 p-4" role="status"><p className="text-[0.52rem] uppercase tracking-[0.15em] text-white/30">Public preview</p><p className="mt-2 text-sm text-white/65">{settings.availabilityEnabled && settings.availabilityMessage ? `${settings.availabilityLabel ? `${settings.availabilityLabel}: ` : ""}${settings.availabilityMessage}` : "Hidden"}</p></div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#111] p-6 lg:p-8">
        <div>
          <div>
            <p className="text-[0.54rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">Homepage copy</p>
            <h2 className="mt-3 text-2xl font-light text-white">Public section content</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/40">Edit homepage-only headlines, labels, links, captions, and availability language. Empty fields fall back to the current production copy.</p>
          </div>
          <div className="mt-7 space-y-6">
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
        <div className="p-6 lg:p-8">
          <div>
            <p className="text-[0.54rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">Homepage imagery</p>
            <h2 className="mt-3 text-2xl font-light text-white">Section images</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/40">Replace the editorial image in The Helios Standard and the image above the footer at any time.</p>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
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
      <nav aria-label="Site Settings sections" className="sticky top-3 z-30 mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-[#151515]/95 p-3 shadow-xl backdrop-blur">
        <div className="flex min-w-max items-center gap-2">
        {settingsSections.map(([id,label]) =>
          <button key={id} type="button" onClick={() => revealAndScroll(id)} className="admin-btn-secondary whitespace-nowrap">{label}</button>)}
        <span aria-hidden="true" className="mx-1 h-7 w-px bg-white/10" />
        <button type="button" disabled={allSettingsExpanded} onClick={() => setExpandedSections(Object.fromEntries(settingsSections.map(([id]) => [id, true])))} className="admin-btn-secondary whitespace-nowrap">Expand All</button>
        <button type="button" disabled={allSettingsCollapsed} onClick={() => setExpandedSections(Object.fromEntries(settingsSections.map(([id]) => [id, false])))} className="admin-btn-secondary whitespace-nowrap">Collapse All</button>
        </div>
      </nav>

      <div id="brand-identity" data-settings-section className="scroll-mt-28">
      <section className="mt-10 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111] sm:mt-12">
        <div className="p-6 lg:p-8">
          <div className="max-w-3xl">
            <div className="flex items-start justify-between gap-4"><div className="min-w-0 pr-2"><p className="eyebrow text-[var(--helios-orange)]">Brand Identity</p>
            <h2 className="mt-3 text-2xl font-light text-white">Logo, business, contact, location, messaging, social and website</h2></div><AdminCardToggle expanded={expandedSections["brand-identity"]} label="Brand Identity" controls="brand-identity-content" onClick={() => toggleSettingsSection("brand-identity")} /></div>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/40">The primary logo powers public brand lockups. The separate square monogram creates a discreet admin-access shortcut today and is ready for future app icons and tenant branding.</p>
          </div>

          <div id="brand-identity-content" hidden={!expandedSections["brand-identity"]} className="mt-8 grid gap-5 lg:grid-cols-2">
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
      {expandedSections["brand-identity"] ? globalIdentityCards : null}
      </div>
      <section id="brand-assets" data-settings-section className="mt-6 scroll-mt-28 rounded-2xl border border-white/[0.08] bg-[#111] p-6">
        <div className="flex items-start justify-between gap-4"><div className="min-w-0 pr-2"><p className="eyebrow text-[var(--helios-orange)]">Brand Assets</p><h2 className="mt-2 text-2xl font-light text-white">Favicon, social share and managed assets</h2></div><AdminCardToggle expanded={expandedSections["brand-assets"]} label="Brand Assets" controls="brand-assets-content" onClick={() => toggleSettingsSection("brand-assets")} /></div>
        <div id="brand-assets-content" hidden={!expandedSections["brand-assets"]} className="mt-6">{brandIdentityAddon}</div>
      </section>

      <section id="booking-experience" data-settings-section className="mt-6 scroll-mt-28 rounded-2xl border border-white/[0.08] bg-[#111] p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div><p className="eyebrow text-[var(--helios-orange)]">Booking Experience</p><h2 className="mt-2 text-2xl font-light text-white">Secure booking handoff</h2><p className="mt-2 max-w-2xl text-sm text-white/38">Business identity and contact details inherit from Business &amp; Contact unless an explicit override is entered. Provider name identifies the external service shown during the handoff.</p></div>
          <AdminCardToggle expanded={expandedSections["booking-experience"]} label="Booking Experience" controls="booking-experience-content" onClick={() => toggleSettingsSection("booking-experience")} />
        </div>
        <div id="booking-experience-content" hidden={!expandedSections["booking-experience"]}>
        <label className="mt-6 flex min-h-11 w-fit items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white/55"><input type="checkbox" checked={settings.bookingHandoffEnabled} onChange={e=>setSettings(current=>({...current,bookingHandoffEnabled:e.target.checked}))}/>Enable handoff page</label>
        {!settings.bookingHandoffEnabled ? <p className="mt-6 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-sm leading-6 text-amber-100/65">The public handoff page is inactive. All configuration remains saved and available below.</p> : null}
        <div className={`mt-6 grid gap-5 sm:grid-cols-2 ${settings.bookingHandoffEnabled ? "" : "opacity-60"}`}>
          <label className="text-xs uppercase tracking-[.14em] text-white/35">Eyebrow<input value={settings.bookingEyebrow||""} onChange={e=>update("bookingEyebrow",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white"/></label>
          <label className="text-xs uppercase tracking-[.14em] text-white/35">Provider name <span className="normal-case tracking-normal text-white/25">(external service)</span><input value={settings.bookingProviderName||""} onChange={e=>update("bookingProviderName",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white"/></label>
          <label className="text-xs uppercase tracking-[.14em] text-white/35 sm:col-span-2">Handoff headline<input value={settings.bookingHandoffHeadline||""} onChange={e=>update("bookingHandoffHeadline",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white"/></label>
          <label className="text-xs uppercase tracking-[.14em] text-white/35 sm:col-span-2">Handoff explanation<textarea rows={3} value={settings.bookingHandoffExplanation||""} onChange={e=>update("bookingHandoffExplanation",e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 p-4 text-sm normal-case leading-6 tracking-normal text-white"/></label>
          <label className="text-xs uppercase tracking-[.14em] text-white/35 sm:col-span-2">Primary button label<input value={settings.bookingPrimaryLabel||""} onChange={e=>update("bookingPrimaryLabel",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white"/></label>
          <fieldset className="rounded-xl border border-white/[0.08] bg-black/20 p-4"><legend className="px-2 text-xs uppercase tracking-[.14em] text-white/35">Phone action</legend><label className="block text-xs uppercase tracking-[.14em] text-white/35">Call button label<input value={settings.bookingCallLabel||""} onChange={e=>update("bookingCallLabel",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white"/></label><label className="mt-4 flex items-center gap-3 text-sm text-white/50"><input type="checkbox" checked={settings.bookingPhoneVisible} onChange={e=>setSettings(current=>({...current,bookingPhoneVisible:e.target.checked}))}/>Show phone action</label></fieldset>
          <fieldset className="rounded-xl border border-white/[0.08] bg-black/20 p-4"><legend className="px-2 text-xs uppercase tracking-[.14em] text-white/35">Email action</legend><label className="block text-xs uppercase tracking-[.14em] text-white/35">Email button label<input value={settings.bookingEmailLabel||""} onChange={e=>update("bookingEmailLabel",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white"/></label><label className="mt-4 flex items-center gap-3 text-sm text-white/50"><input type="checkbox" checked={settings.bookingEmailVisible} onChange={e=>setSettings(current=>({...current,bookingEmailVisible:e.target.checked}))}/>Show email action</label></fieldset>
        </div>
        </div>
      </section>

      <section id="global-controls" data-settings-section className={`mt-6 scroll-mt-28 rounded-2xl border p-6 ${settings.bookingMode === "ONLINE" ? "border-white/[0.08] bg-[#111]" : "border-[var(--helios-orange)]/45 bg-[var(--helios-orange)]/[0.045]"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">Global Controls</p><h2 className="mt-2 text-2xl font-light text-white">Booking availability</h2><p className="mt-2 text-sm text-white/38">Every public booking action follows the saved workspace configuration.</p></div><div className="flex items-start gap-3"><div className="flex flex-col items-end gap-2"><span className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[.12em] ${bookingPill}`}>{bookingLabel}</span>{bookingDirty&&<span className="text-xs text-amber-200">Unsaved changes</span>}</div><AdminCardToggle expanded={expandedSections["global-controls"]} label="Global Controls" controls="global-controls-content" onClick={() => toggleSettingsSection("global-controls")} /></div></div>
        <div id="global-controls-content" hidden={!expandedSections["global-controls"]}>
        {bookingOnline&&<p className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-4 text-sm text-white/35">Outage messaging remains saved but only becomes publicly active when booking is Temporarily Unavailable or Paused.</p>}
        <div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="text-xs uppercase tracking-[.14em] text-white/35">Booking mode<select value={settings.bookingMode} onChange={(event) => setSettings(current => ({ ...current, bookingMode: event.target.value as PublicSiteSettings["bookingMode"] }))} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm normal-case tracking-normal text-white"><option value="ONLINE">Online</option><option value="UNAVAILABLE">Temporarily Unavailable</option><option value="PAUSED">Booking Paused</option></select></label><label className="text-xs uppercase tracking-[.14em] text-white/35">External booking destination<input value={settings.bookingUrl ?? ""} onChange={(e) => update("bookingUrl", e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white" /></label><label className="text-xs uppercase tracking-[.14em] text-white/35">Public headline<input value={settings.bookingHeadline ?? ""} onChange={(e) => update("bookingHeadline", e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white" /></label><label className="text-xs uppercase tracking-[.14em] text-white/35">Estimated restoration<input type="datetime-local" value={settings.bookingEstimatedRestoreAt ? new Date(settings.bookingEstimatedRestoreAt).toISOString().slice(0,16) : ""} onChange={(e) => setSettings(current => ({ ...current, bookingEstimatedRestoreAt: e.target.value ? new Date(e.target.value).toISOString() : null }))} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white" /></label><label className="text-xs uppercase tracking-[.14em] text-white/35 sm:col-span-2">Public explanation<textarea rows={4} value={settings.bookingExplanation ?? ""} onChange={(e) => update("bookingExplanation", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 p-4 text-sm normal-case leading-6 tracking-normal text-white" /></label><label className="text-xs uppercase tracking-[.14em] text-white/35">Contact phone<input value={settings.bookingContactPhone ?? ""} onChange={(e) => update("bookingContactPhone", e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white" /></label><label className="text-xs uppercase tracking-[.14em] text-white/35">Contact email<input value={settings.bookingContactEmail ?? ""} onChange={(e) => update("bookingContactEmail", e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white" /></label><label className="text-xs uppercase tracking-[.14em] text-white/35 sm:col-span-2">Banner message<input value={settings.bookingBannerMessage ?? ""} onChange={(e) => update("bookingBannerMessage", e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm normal-case tracking-normal text-white" /></label><label className="flex items-center gap-3 text-sm text-white/50"><input type="checkbox" checked={settings.bookingBannerEnabled} onChange={(e) => setSettings(current => ({ ...current, bookingBannerEnabled: e.target.checked }))} className="accent-[var(--helios-orange)]" />Show public status banner</label><label className="flex items-center gap-3 text-sm text-white/50"><input type="checkbox" checked={settings.bookingRequestEnabled} onChange={(e) => setSettings(current => ({ ...current, bookingRequestEnabled: e.target.checked }))} className="accent-[var(--helios-orange)]" />Enable booking-request form</label></div>
        <div className="mt-6 rounded-xl border border-white/10 bg-black/25 p-5"><p className="text-[.52rem] uppercase tracking-[.14em] text-white/30">Unavailable-state preview</p><p className="mt-3 text-xl font-light text-white">{settings.bookingHeadline}</p><p className="mt-2 text-sm leading-6 text-white/40">{settings.bookingExplanation}</p></div>
        </div>
      </section>

      <section id="content-discovery" data-settings-section className="mt-6 scroll-mt-28 rounded-2xl border border-white/[0.08] bg-[#111] p-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0 pr-2"><p className="eyebrow text-[var(--helios-orange)]">Content &amp; Discovery</p><h2 className="mt-2 text-xl font-light text-white">Blog Studio Voice</h2><p className="mt-2 text-sm text-white/35">Long-form guidance used by the existing Blog Studio AI workflow.</p></div><AdminCardToggle expanded={expandedSections["content-discovery"]} label="Content & Discovery" controls="content-discovery-content" onClick={() => toggleSettingsSection("content-discovery")} /></div><div id="content-discovery-content" hidden={!expandedSections["content-discovery"]}><div className="mt-6 flex justify-end"><button type="button" onClick={() => setVoiceExpanded(true)} className="admin-btn-secondary">Expand Editor</button></div><div className="mt-6 grid gap-5 lg:grid-cols-3">{([["brandVoice","Brand voice"],["brandAudience","Primary audience"],["brandWritingGuidance","Writing guardrails"]] as const).map(([key,label]) => <label key={key} className="text-xs uppercase tracking-[.14em] text-white/35">{label}<textarea rows={7} value={settings[key] ?? ""} onChange={(e) => update(key,e.target.value)} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 p-4 text-sm font-normal normal-case leading-6 tracking-normal text-white" /></label>)}</div><label className="mt-5 block text-xs uppercase tracking-[.14em] text-white/35">Default article author<input value={settings.defaultBlogAuthor ?? ""} onChange={(e) => update("defaultBlogAuthor",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm font-normal normal-case tracking-normal text-white" /></label></div></section>
      {voiceExpanded && <div role="dialog" aria-modal="true" aria-labelledby="voice-editor-title" aria-describedby="voice-editor-description" className="fixed inset-0 z-[100] overflow-y-auto bg-black/85 p-4 backdrop-blur"><div className="mx-auto my-4 min-h-[calc(100vh-2rem)] max-w-6xl rounded-2xl border border-white/10 bg-[#111] p-6 sm:p-8"><div className="flex justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">Blog Studio</p><h2 id="voice-editor-title" className="mt-2 text-3xl font-light text-white">Voice Editor</h2><p id="voice-editor-description" className="mt-2 text-sm text-white/35">Changes remain available in the standard editor until you save settings.</p></div><button ref={voiceCloseRef} onClick={() => setVoiceExpanded(false)} className="admin-btn-secondary">Close</button></div><div className="mt-8 grid gap-6">{([["brandVoice","Brand voice"],["brandAudience","Primary audience"],["brandWritingGuidance","Writing guardrails"]] as const).map(([key,label]) => <label key={key} className="text-xs uppercase tracking-[.14em] text-white/35">{label}<textarea rows={8} value={settings[key] ?? ""} onChange={(e) => update(key,e.target.value)} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 p-5 text-base font-normal normal-case leading-7 tracking-normal text-white" /></label>)}</div><div className="mt-8 flex justify-end gap-3"><button onClick={() => setVoiceExpanded(false)} className="admin-btn-secondary">Keep editing later</button><button disabled={saving} onClick={async () => { await persist(settings, "Blog Studio Voice saved."); setVoiceExpanded(false); }} className="admin-btn-primary">{saving ? "Saving…" : "Save Settings"}</button></div></div></div>}

      <section id="search-appearance" data-settings-section className="mt-6 scroll-mt-28 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111] p-6 lg:p-8">
        <div className="flex items-start justify-between gap-4"><div className="min-w-0 pr-2"><p className="eyebrow text-[var(--helios-orange)]">Search Appearance</p><h2 className="mt-2 text-2xl font-light text-white">Homepage SEO preview</h2></div><AdminCardToggle expanded={expandedSections["search-appearance"]} label="Search Appearance" controls="search-appearance-content" onClick={() => toggleSettingsSection("search-appearance")} /></div>
        <div id="search-appearance-content" hidden={!expandedSections["search-appearance"]} className="mt-6 grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
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

      <section id="legal-privacy" data-settings-section className="mt-6 scroll-mt-28 rounded-2xl border border-white/[0.08] bg-[#111] p-6">
        <div className="flex items-start justify-between gap-4"><div className="min-w-0 pr-2"><p className="eyebrow text-[var(--helios-orange)]">Legal &amp; Privacy</p><h2 className="mt-2 text-2xl font-light text-white">Legal documents</h2><p className="mt-2 text-sm text-white/35">Manage the legal documents linked from the public experience.</p></div><AdminCardToggle expanded={expandedSections["legal-privacy"]} label="Legal & Privacy" controls="legal-privacy-content" onClick={() => toggleSettingsSection("legal-privacy")} /></div>
        <div id="legal-privacy-content" hidden={!expandedSections["legal-privacy"]} className="mt-6">{legalAddon}</div>
      </section>
        </>
      ) : null}

      <div className="sticky bottom-[max(1.25rem,env(safe-area-inset-bottom))] mt-10 flex items-center justify-between gap-5 rounded-2xl border border-white/10 bg-[#161616]/95 p-4 shadow-2xl backdrop-blur-xl">
        <p role="status" className="text-sm text-white/40">
          {message ||
            (dirty ? "Unsaved changes." : "All settings are saved.")}
        </p>
        <button
          type="button"
          onClick={() => void persist(settings)}
          disabled={saving || uploading !== null || !dirty}
          className="shrink-0 admin-btn-primary"
        >
          {saving ? "Saving…" : mode === "homepage" ? "Save Homepage Settings" : "Save settings"}
        </button>
      </div>
      {mediaPreview === "poster" ? <div role="dialog" aria-modal="true" aria-label="Poster image preview" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setMediaPreview(null); }}><div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#111] p-5"><div className="mb-4 flex items-center justify-between gap-4"><p className="text-sm text-white/60">Poster image preview</p><button type="button" autoFocus onClick={() => setMediaPreview(null)} className="admin-btn-secondary">Close</button></div><>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={settings.heroPosterUrl || ""} alt={settings.heroPosterAlt || "Current homepage poster"} className="max-h-[75vh] w-full object-contain" />
      </></div></div> : null}
    </div>
  );
}
