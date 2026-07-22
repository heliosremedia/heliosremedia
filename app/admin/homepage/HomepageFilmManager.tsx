"use client";

import { useState } from "react";

export type HomepageFilmSettings = {
  featuredFilmEnabled: boolean;
  featuredFilmVideoStorageKey: string | null;
  featuredFilmVideoUrl: string | null;
  featuredFilmPosterStorageKey: string | null;
  featuredFilmPosterUrl: string | null;
  featuredFilmDestination: string | null;
};

type Kind = "video" | "poster";

function upload(file: File, url: string, contentType: string, progress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.upload.onprogress = (event) => { if (event.lengthComputable) progress(Math.round((event.loaded / event.total) * 100)); };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("Cloudflare R2 rejected the upload."));
    request.onerror = () => reject(new Error("The upload connection was interrupted."));
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    request.send(file);
  });
}

export default function HomepageFilmManager({ initialSettings }: { initialSettings: HomepageFilmSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [busy, setBusy] = useState<Kind | "save" | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  async function save(next = settings, success = "Featured film settings saved.") {
    setBusy("save"); setMessage(null);
    try {
      const response = await fetch("/api/admin/homepage-film", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to save featured film settings.");
      const saved: HomepageFilmSettings = {
        featuredFilmEnabled: data.settings.featuredFilmEnabled,
        featuredFilmVideoStorageKey: data.settings.featuredFilmVideoStorageKey,
        featuredFilmVideoUrl: data.settings.featuredFilmVideoUrl,
        featuredFilmPosterStorageKey: data.settings.featuredFilmPosterStorageKey,
        featuredFilmPosterUrl: data.settings.featuredFilmPosterUrl,
        featuredFilmDestination: data.settings.featuredFilmDestination,
      };
      setSettings(saved); setMessage(success);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save featured film settings."); throw error; }
    finally { setBusy(null); }
  }

  async function uploadMedia(kind: Kind, file: File) {
    setBusy(kind); setProgress(0); setMessage(`Preparing featured ${kind}…`);
    try {
      const response = await fetch("/api/admin/homepage-film/presign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, fileName: file.name, fileType: file.type, fileSize: file.size }) });
      const data = await response.json();
      if (!response.ok || !data.success || !data.upload) throw new Error(data.error || "Unable to prepare this upload.");
      await upload(file, data.upload.uploadUrl, data.upload.contentType, setProgress);
      const next = kind === "video"
        ? { ...settings, featuredFilmVideoStorageKey: data.upload.key, featuredFilmVideoUrl: data.upload.publicUrl }
        : { ...settings, featuredFilmPosterStorageKey: data.upload.key, featuredFilmPosterUrl: data.upload.publicUrl };
      setSettings(next);
      await save(next, kind === "video" ? "Featured film uploaded. Enable it when ready." : "Featured film poster uploaded.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The featured media could not be uploaded."); }
    finally { setBusy(null); setProgress(0); }
  }

  const locked = busy !== null;

  return <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-5 sm:p-7">
    <div className="grid gap-7 lg:grid-cols-[0.8fr_1.2fr]">
      <div><p className="eyebrow text-[var(--helios-orange)]">Featured cinematic media</p><h2 className="mt-2 text-2xl font-light text-white">Cinematic Films hero card</h2><p className="mt-3 max-w-lg text-sm leading-6 text-white/38">Optionally replace the static card image with a muted, looping film. Playback begins only while the card is visible and respects reduced-motion preferences.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5"><p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">Featured film</p><p className="mt-3 text-sm text-white/65">MP4 or WebM · 16:9 · under 500 MB</p><p className="mt-2 truncate text-xs text-white/25">{settings.featuredFilmVideoUrl || "No film uploaded"}</p><label className={`mt-5 admin-btn-primary cursor-pointer ${locked ? "pointer-events-none opacity-40" : ""}`}>{settings.featuredFilmVideoUrl ? "Replace film" : "Upload film"}<input type="file" accept="video/mp4,video/webm" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia("video", file); event.target.value = ""; }} /></label></div>
        <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5"><p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">Poster fallback</p><p className="mt-3 text-sm text-white/65">JPG, PNG, WebP, or AVIF · 1920×1080</p><p className="mt-2 truncate text-xs text-white/25">{settings.featuredFilmPosterUrl || "Uses the current card image"}</p><label className={`mt-5 admin-btn-secondary cursor-pointer ${locked ? "pointer-events-none opacity-40" : ""}`}>{settings.featuredFilmPosterUrl ? "Replace poster" : "Upload poster"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia("poster", file); event.target.value = ""; }} /></label></div>
      </div>
    </div>
    {busy === "video" || busy === "poster" ? <div className="mt-5"><div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[var(--helios-orange)] transition-[width]" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-white/35">Uploading {progress}%</p></div> : null}
    <div className="mt-6 grid gap-5 border-t border-white/[0.08] pt-6 sm:grid-cols-[1fr_auto] sm:items-end"><label className="block text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Card destination<input value={settings.featuredFilmDestination || ""} onChange={(event) => setSettings({ ...settings, featuredFilmDestination: event.target.value })} placeholder="/portfolio?service=cinematic-films" className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label><label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 px-4 text-sm text-white/55"><input type="checkbox" checked={settings.featuredFilmEnabled} disabled={!settings.featuredFilmVideoUrl || locked} onChange={(event) => setSettings({ ...settings, featuredFilmEnabled: event.target.checked })} className="h-4 w-4 accent-[var(--helios-orange)]" />Show film on homepage</label></div>
    <div className="mt-5 flex items-center justify-between gap-4"><p role="status" className="text-xs text-white/30">{message || "The static Cinematic Films image remains the fallback."}</p><button type="button" disabled={locked} onClick={() => void save()} className="admin-btn-primary">{busy === "save" ? "Saving…" : "Save feature"}</button></div>
  </section>;
}
