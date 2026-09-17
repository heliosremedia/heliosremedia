"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { acceptFilmAcknowledgement, canonicalFilmUrl, filmDestination, scopedFilmKey, type FilmKind, type FilmSettings } from '@/lib/featured-film-editor';
import type { SettingsRevision } from '@/lib/site-settings-editor';
import { emptySettingsCopies, readSettingsCopies, refreshSettingsCopies, registerSettingsCopy, subscribeSettingsCopies } from '@/app/admin/settings/settingsDraftCopies';

type Outcome = 'idle' | 'saving' | 'saved' | 'conflict' | 'uncertain';
function upload(file: File, url: string, contentType: string, signal: AbortSignal, progress: (n: number) => void) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => { xhr.abort(); reject(new Error('UPLOAD_ABORTED')); };
    const finish = (error?: Error) => { signal.removeEventListener('abort', abort); if (error) reject(error); else resolve(); };
    xhr.upload.onprogress = event => { if (!signal.aborted && event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => finish(xhr.status >= 200 && xhr.status < 300 ? undefined : new Error('UPLOAD_FAILED'));
    xhr.onerror = () => finish(new Error('UPLOAD_FAILED'));
    xhr.onabort = () => finish(new Error('UPLOAD_ABORTED'));
    signal.addEventListener('abort', abort, { once: true });
    xhr.open('PUT', url); xhr.setRequestHeader('Content-Type', contentType); xhr.send(file);
  });
}

export function useFilmRecovery(initialSettings: FilmSettings, initialRevision: SettingsRevision) {
  const [settings, render] = useState(initialSettings);
  const [saved, setSaved] = useState(initialSettings);
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [progress, setProgress] = useState(0);
  const [kind, setKind] = useState<FilmKind | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const current = useRef(initialSettings), confirmed = useRef(initialSettings), revision = useRef(initialRevision);
  const admission = useRef(false), mounted = useRef(true), preserved = useRef<string | null>(null);
  const active = useRef<{ controller: AbortController; cancelled: boolean } | null>(null);
  const copies = useSyncExternalStore(subscribeSettingsCopies, readSettingsCopies, emptySettingsCopies);
  const held = outcome === 'uncertain' || outcome === 'conflict', saving = outcome === 'saving', locked = saving || held;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (active.current) { active.current.cancelled = true; active.current.controller.abort(); } }; }, []);
  useEffect(() => registerSettingsCopy(current, () => ({ scope: 'featured-film', revision: revision.current, settings: current.current, confirmedSettings: confirmed.current })), []);
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  useEffect(() => {
    if (!dirty && !locked) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, locked]);
  function setSettings(next: FilmSettings) {
    if (!mounted.current || admission.current || current.current !== settings) return;
    current.current = next; render(next); refreshSettingsCopies(); setOutcome('idle');
  }
  async function save(next = settings, media?: { kind: FilmKind; file: File }) {
    if (!mounted.current || admission.current || current.current !== settings) return;
    admission.current = true;
    const operation = { controller: new AbortController(), cancelled: false }; active.current = operation;
    const valid = () => mounted.current && active.current === operation && !operation.cancelled;
    let frozen = { ...next };
    const prior = { ...revision.current }, before = { ...confirmed.current }, requestId = crypto.randomUUID();
    current.current = frozen; render(frozen); refreshSettingsCopies(); setOutcome('saving'); setKind(media?.kind ?? null); setProgress(0); preserved.current = null; setCopied(null);
    async function bounded<T>(work: () => Promise<T>, ms: number) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { return await Promise.race([work(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { operation.cancelled = true; operation.controller.abort(); reject(new Error('TIMEOUT')); }, ms);
      })]); } finally { if (timer !== undefined) clearTimeout(timer); }
    }
    try {
      filmDestination(frozen.featuredFilmDestination);
      if (media) {
        await bounded(async () => {
          const response = await fetch('/api/admin/homepage-film/presign', { method: 'POST', signal: operation.controller.signal,
            headers: { 'Content-Type': 'application/json', 'x-helios-film-revision': '1' },
            body: JSON.stringify({ requestId, kind: media.kind, fileName: media.file.name, fileType: media.file.type, fileSize: media.file.size }) });
          const data = await response.json(); if (!valid()) return;
          const prepared = data?.upload, ack = data?.acknowledgement;
          if (!response.ok || data.success !== true || ack?.protocol !== 1 || ack.requestId !== requestId || ack.workspaceId !== prior.workspaceId || ack.kind !== media.kind || ack.registered !== true
            || !scopedFilmKey(prepared?.key, prior.workspaceId, media.kind) || prepared.key !== ack.key || prepared.publicUrl !== ack.publicUrl
            || !canonicalFilmUrl(prepared.publicUrl, prepared.key) || typeof prepared.uploadUrl !== 'string' || !/^https?:\/\//.test(prepared.uploadUrl)
            || prepared.contentType !== media.file.type) throw new Error('UPLOAD_ACK');
          await upload(media.file, prepared.uploadUrl, prepared.contentType, operation.controller.signal, n => { if (valid()) setProgress(n); });
          if (!valid()) return;
          frozen = media.kind === 'video' ? { ...frozen, featuredFilmVideoStorageKey: prepared.key, featuredFilmVideoUrl: prepared.publicUrl }
            : { ...frozen, featuredFilmPosterStorageKey: prepared.key, featuredFilmPosterUrl: prepared.publicUrl };
          current.current = frozen; render(frozen); refreshSettingsCopies();
        }, 600000);
        if (!valid()) return;
      }
      setKind(null);
      const { response, data } = await bounded(async () => {
        const response = await fetch('/api/admin/homepage-film', { method: 'PATCH', signal: operation.controller.signal,
          headers: { 'Content-Type': 'application/json', 'x-helios-film-revision': '1' }, body: JSON.stringify({ ...frozen, editorRevision: prior, requestId }) });
        return { response, data: await response.json() };
      }, 30000);
      if (!valid()) return;
      if (response.status === 409) throw new Error('CONFLICT');
      const result = response.ok ? acceptFilmAcknowledgement(data, requestId, prior, frozen, before) : null;
      if (!result) throw new Error('ACKNOWLEDGEMENT');
      revision.current = result.revision; current.current = result.settings; confirmed.current = result.settings;
      render(result.settings); setSaved(result.settings); refreshSettingsCopies(); admission.current = false; setOutcome('saved');
    } catch (error) {
      if (!mounted.current || active.current !== operation) return;
      setKind(null); setOutcome(error instanceof Error && error.message === 'CONFLICT' ? 'conflict' : 'uncertain');
    }
  }
  const message = outcome === 'saving' ? 'Saving featured film…' : outcome === 'saved' ? 'Featured film saved and confirmed.'
    : outcome === 'conflict' ? 'Featured film settings changed. Your draft is retained. Preserve a copy and reload to reconcile.'
    : outcome === 'uncertain' ? 'Featured film outcome is uncertain. Your draft is retained. Preserve a copy and reload to check saved state before making another change.'
    : 'Featured film settings loaded.';
  return { settings, setSettings, save, saved, locked, saving, kind, progress, message,
    recovery: held ? <section className="mt-5 min-w-0 rounded-xl border border-amber-300/30 p-4">
      <p role="alert">{message}</p>
      <p className="mt-3 text-sm">Copy the open drafts below before reloading, then compare them with saved settings. Preserve changes in other tools too. Reload never retries a save or upload. Removing a reference does not delete stored media.</p>
      <textarea aria-label="Unsaved featured film copy" readOnly value={copies} onFocus={event => event.currentTarget.select()} className="mt-3 h-48 w-full min-w-0 bg-black/30 p-3 font-mono text-xs" />
      <label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" aria-label="I have preserved my film copy" checked={copied === copies} onChange={event => { preserved.current = event.target.checked ? copies : null; setCopied(preserved.current); }} />I have preserved my film copy</label>
      <button type="button" disabled={copied !== copies} className="admin-btn-secondary" onClick={() => { if (preserved.current !== null && preserved.current === readSettingsCopies()) window.location.reload(); }}>Reload saved film</button>
    </section> : null };
}
