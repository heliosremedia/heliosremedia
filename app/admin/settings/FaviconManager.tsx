"use client";
/* eslint-disable @next/next/no-img-element -- managed brand previews may use remote URLs and ICO files. */

import { useState } from "react";
import type { PublicSiteSettings } from "@/lib/site-settings";

async function put(file: File, url: string) {
  return fetch(url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
}

export default function FaviconManager({ initialSettings }: { initialSettings: PublicSiteSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [busy, setBusy] = useState<"favicon" | "social" | "restore" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(next: PublicSiteSettings, success: string) {
    const saved = await fetch("/api/admin/site-settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next),
    });
    const result = await saved.json();
    if (!saved.ok || !result.success) throw new Error(result.error || "Unable to publish brand settings.");
    setSettings(result.settings);
    setMessage(success);
  }

  async function upload(kind: "favicon" | "social", file: File) {
    setBusy(kind); setMessage(null);
    try {
      const bitmap = await createImageBitmap(file);
      if (kind === "favicon") {
        if (bitmap.width !== bitmap.height || bitmap.width < 256) throw new Error("Choose a square PNG at least 256 × 256 pixels.");
      } else if (bitmap.width !== 1200 || bitmap.height !== 630) {
        throw new Error("Choose a social share image that is exactly 1200 × 630 pixels.");
      }
      bitmap.close();
      const endpoint = kind === "favicon" ? "/api/admin/site-settings/favicon/presign" : "/api/admin/site-settings/social-image/presign";
      const prepared = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
      });
      const data = await prepared.json();
      if (!prepared.ok || !data.success) throw new Error(data.error || "Unable to prepare upload.");
      const sent = await put(file, data.upload.uploadUrl);
      if (!sent.ok) throw new Error("Cloud storage rejected the upload.");
      const next = kind === "favicon"
        ? { ...settings, faviconStorageKey: data.upload.key, faviconUrl: data.upload.publicUrl }
        : { ...settings, defaultSocialImageStorageKey: data.upload.key, defaultSocialImageUrl: data.upload.publicUrl, defaultSocialImageAlt: settings.defaultSocialImageAlt || `${settings.businessName} social share image` };
      await save(next, kind === "favicon" ? "Favicon published. Browser tabs may take a moment to refresh." : "Default social share image published.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to publish this asset.");
    } finally { setBusy(null); }
  }

  async function restoreSocialFallback() {
    setBusy("restore"); setMessage(null);
    try {
      await save({ ...settings, defaultSocialImageStorageKey: null, defaultSocialImageUrl: null }, "Automatic social-image fallback restored.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to restore the automatic fallback.");
    } finally { setBusy(null); }
  }

  return (
    <section aria-labelledby="browser-sharing-heading" className="rounded-2xl border border-white/[0.08] bg-[#111] p-6 lg:p-8">
      <div>
        <p className="eyebrow text-[var(--helios-orange)]">Brand assets</p>
        <h2 id="browser-sharing-heading" className="mt-2 text-2xl font-light text-white">Browser identity &amp; social sharing</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/40">Complete the workspace identity used in browser tabs and as the branded fallback for public link previews.</p>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5">
          <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">Favicon / browser identity</p>
          <div className="mt-4 flex items-center gap-4 rounded-xl border border-white/[0.08] bg-[#202124] p-3">
            <img src={settings.faviconUrl || "/favicon.ico"} alt="Current favicon preview" className="h-8 w-8 rounded object-contain" />
            <div className="min-w-0"><p className="truncate text-sm text-white/75">{settings.businessName}</p><p className="truncate text-xs text-white/35">{settings.websiteUrl || "Public website"}</p></div>
          </div>
          <p className="mt-3 text-xs leading-5 text-white/35">Square PNG · minimum 256 × 256 · under 5 MB</p>
          <label className={`admin-btn-primary mt-5 cursor-pointer ${busy ? "pointer-events-none opacity-40" : ""}`}>{busy === "favicon" ? "Publishing…" : settings.faviconUrl ? "Replace favicon" : "Upload favicon"}<input type="file" accept="image/png" className="sr-only" disabled={Boolean(busy)} onChange={event => { const file = event.target.files?.[0]; if (file) void upload("favicon", file); event.target.value = ""; }} /></label>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5">
          <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">Default social share image</p>
          <p className="mt-2 text-xs leading-5 text-white/35">JPG, PNG, WebP, or AVIF · 1200 × 630 recommended · under 10 MB</p>
          <div className="mt-4 aspect-[1.91/1] overflow-hidden rounded-xl border border-white/[0.08] bg-black">
            <img src={settings.defaultSocialImageUrl || settings.brandMonogramUrl || settings.brandLogoUrl || "/brand/helios-logo.png"} alt={settings.defaultSocialImageAlt || "Current workspace social share preview"} className="h-full w-full object-cover" />
          </div>
          <label className="mt-4 block text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Accessible image description<input value={settings.defaultSocialImageAlt || ""} onChange={event => setSettings(current => ({ ...current, defaultSocialImageAlt: event.target.value }))} onBlur={event => void save({ ...settings, defaultSocialImageAlt: event.currentTarget.value }, "Social image description saved.")} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>
          <div className="mt-5 flex flex-wrap gap-3">
            <label className={`admin-btn-primary cursor-pointer ${busy ? "pointer-events-none opacity-40" : ""}`}>{busy === "social" ? "Publishing…" : settings.defaultSocialImageUrl ? "Replace share image" : "Upload share image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={Boolean(busy)} onChange={event => { const file = event.target.files?.[0]; if (file) void upload("social", file); event.target.value = ""; }} /></label>
            {settings.defaultSocialImageUrl ? <button type="button" disabled={Boolean(busy)} onClick={() => void restoreSocialFallback()} className="admin-btn-secondary">Restore automatic fallback</button> : null}
          </div>
        </div>
      </div>
      {message ? <p role="status" className="mt-4 text-sm text-white/50">{message}</p> : null}
    </section>
  );
}
