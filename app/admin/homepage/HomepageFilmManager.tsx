"use client";

import { useFilmRecovery } from './useFilmRecovery';
import type { FilmSettings } from '@/lib/featured-film-editor';
import type { SettingsRevision } from '@/lib/site-settings-editor';
export type HomepageFilmSettings = FilmSettings;

export default function HomepageFilmManager({ initialSettings, initialRevision }: { initialSettings: FilmSettings; initialRevision: SettingsRevision }) {
  const { settings, setSettings, save, saved, locked, saving, kind, progress, message, recovery } = useFilmRecovery(initialSettings, initialRevision);
  return <section aria-busy={saving} className="rounded-2xl border border-white/[0.08] bg-[#111] p-5 sm:p-7">
    <div className="grid min-w-0 gap-7 lg:grid-cols-[0.8fr_1.2fr]">
      <div><p className="eyebrow text-[var(--helios-orange)]">Featured cinematic media</p><h2 className="mt-2 text-2xl font-light text-white">Cinematic Films hero card</h2><p className="mt-3 max-w-lg text-sm leading-6 text-white/38">Optionally replace the static card image with a muted, looping film. Playback begins only while the card is visible and respects reduced-motion preferences.</p></div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-black/25 p-5"><p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">Featured film</p><p className="mt-3 text-sm text-white/65">MP4 or WebM · 16:9 · under 500 MB</p><p className="mt-2 truncate text-xs text-white/25">{settings.featuredFilmVideoUrl || "No film uploaded"}</p><label className={`mt-5 admin-btn-primary cursor-pointer ${locked ? "pointer-events-none opacity-40" : ""}`}>{settings.featuredFilmVideoUrl ? "Replace film" : "Upload film"}<input type="file" disabled={locked} accept="video/mp4,video/webm" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void save(settings, { kind: "video", file }); event.target.value = ""; }} /></label></div>
        <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-black/25 p-5"><p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/45">Poster fallback</p><p className="mt-3 text-sm text-white/65">JPG, PNG, WebP, or AVIF · 1920×1080</p><p className="mt-2 truncate text-xs text-white/25">{settings.featuredFilmPosterUrl || "Uses the current card image"}</p><label className={`mt-5 admin-btn-secondary cursor-pointer ${locked ? "pointer-events-none opacity-40" : ""}`}>{settings.featuredFilmPosterUrl ? "Replace poster" : "Upload poster"}<input type="file" disabled={locked} accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void save(settings, { kind: "poster", file }); event.target.value = ""; }} /></label></div>
      </div>
    </div>
    {kind === "video" || kind === "poster" ? <div className="mt-5"><div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[var(--helios-orange)] transition-[width]" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-white/35">Uploading {progress}%</p></div> : null}
    <div className="mt-6 grid gap-5 border-t border-white/[0.08] pt-6 sm:grid-cols-[1fr_auto] sm:items-end"><label className="block text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-white/35">Card destination<input disabled={locked} value={settings.featuredFilmDestination || ""} onChange={(event) => setSettings({ ...settings, featuredFilmDestination: event.target.value })} placeholder="/portfolio?service=cinematic-films" className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label><label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 px-4 text-sm text-white/55"><input type="checkbox" checked={settings.featuredFilmEnabled} disabled={!settings.featuredFilmVideoUrl || locked} onChange={(event) => setSettings({ ...settings, featuredFilmEnabled: event.target.checked })} className="h-4 w-4 accent-[var(--helios-orange)]" />Show film on homepage</label></div>
    <p className="mt-4 text-xs text-white/45">Confirmed homepage film: {saved.featuredFilmEnabled ? "enabled" : "disabled"}</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" className="admin-btn-secondary" disabled={locked || !settings.featuredFilmVideoUrl} onClick={() => void save({ ...settings, featuredFilmEnabled: false, featuredFilmVideoStorageKey: null, featuredFilmVideoUrl: null })}>Remove film reference</button>
      <button type="button" className="admin-btn-secondary" disabled={locked || !settings.featuredFilmPosterUrl} onClick={() => void save({ ...settings, featuredFilmPosterStorageKey: null, featuredFilmPosterUrl: null })}>Remove poster reference</button>
    </div>
    {recovery}
    <div className="mt-5 flex items-center justify-between gap-4"><p role="status" className="text-xs text-white/30">{message || "The static Cinematic Films image remains the fallback."}</p><button type="button" disabled={locked} onClick={() => void save()} className="admin-btn-primary">{saving ? "Saving…" : "Save feature"}</button></div>
  </section>;
}
