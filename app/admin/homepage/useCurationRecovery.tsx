"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { registerSettingsCopy, refreshSettingsCopies, subscribeSettingsCopies, readSettingsCopies, emptySettingsCopies } from '@/app/admin/settings/settingsDraftCopies';

type Token = { controller: AbortController; revision: string; requestId: string };
export function useCurationRecovery<T>(scope: 'projects' | 'work-cards', workspaceId: string, initialRevision: string, initialDraft: T) {
 const [status, setStatus] = useState('');
 const [blocked, setBlocked] = useState(false);
 const [retainedCopy, setRetainedCopy] = useState<string | null>(null);
 const [draft, renderDraft] = useState(initialDraft);
 const [renderedRevision, renderRevision] = useState(initialRevision);
 const revision = useRef(initialRevision);

 const alive = useRef(true);
 const active = useRef<Token | null>(null);
 const latest = useRef(initialDraft);
 function setDraft(update: (current: T) => T) { latest.current = update(latest.current); renderDraft(latest.current); refreshSettingsCopies(); }
 const copyKey = useRef({});
 const attempted = useRef<unknown>(null);
 const dirty = useRef(false);
 const copies = useSyncExternalStore(subscribeSettingsCopies, readSettingsCopies, emptySettingsCopies);
 useEffect(() => {
  alive.current = true;
  const unregister = registerSettingsCopy(copyKey.current, () => ({ scope, workspaceId, revision: revision.current, draft: latest.current, attempted: attempted.current }));
  const warning = (event: BeforeUnloadEvent) => { if (dirty.current || active.current) { event.preventDefault(); event.returnValue = ''; } };
  window.addEventListener('beforeunload', warning);
  return () => { alive.current = false; active.current?.controller.abort(); active.current = null; unregister(); window.removeEventListener('beforeunload', warning); };
 }, [workspaceId, scope]);
 useEffect(() => { refreshSettingsCopies(); }, [draft]);
 function current(token: Token) { return alive.current && active.current === token; }
 function edit(snapshot: unknown) { if (!alive.current || snapshot !== latest.current) return false; dirty.current = true; setRetainedCopy(null); return true; }
 function begin(snapshot: unknown, intent: unknown) {
  if (!alive.current || active.current || blocked || snapshot !== latest.current || revision.current !== renderedRevision) return null;
  const token = { controller: new AbortController(), revision: revision.current, requestId: crypto.randomUUID() };
  active.current = token; attempted.current = intent; dirty.current = true; setStatus('Saving…'); setRetainedCopy(null); refreshSettingsCopies(); return token;
 }
 function fail(token: Token, conflict = false) {
  if (!current(token)) return;
  token.controller.abort(); setBlocked(true);
  setStatus(conflict ? 'Conflict: curation changed. Retain your drafts and reload to reconcile.' : 'Outcome uncertain. No write will be retried. Retain your drafts and reload to reconcile.');
  refreshSettingsCopies();
 }
 async function transport(token: Token, url: string, options: RequestInit) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
   return await Promise.race([
    (async () => { const response = await fetch(url, { ...options, signal: token.controller.signal, headers: { 'Content-Type': 'application/json', ...options.headers } }); const data = await response.json(); if (!response.ok || data?.success !== true) { if (response.status === 409) fail(token, true); throw new Error('CURATION_RESPONSE'); } return data; })(),
    new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { token.controller.abort(); reject(new Error('CURATION_TIMEOUT')); }, 20000); }),
   ]);
  } finally { clearTimeout(timer); }
 }
 async function mutate(token: Token, url: string, options: RequestInit, validate: (data: Record<string, unknown>, ids: string[]) => boolean) {
  try {
   const data = await transport(token, url, { ...options, headers: { 'x-curation-revision': token.revision, 'x-curation-request': token.requestId } });
   if (!current(token)) return null;
   const ack = data?.acknowledgement;
   if (!ack || ack.protocol !== 1 || ack.requestId !== token.requestId || ack.workspaceId !== workspaceId || ack.scope !== scope || ack.previousRevision !== token.revision || typeof ack.revision !== 'string' || !/^[a-f0-9]{64}$/.test(ack.revision) || ack.revision === token.revision || !Array.isArray(ack.ids) || ack.ids.some((id: unknown) => typeof id !== 'string') || new Set(ack.ids).size !== ack.ids.length || !validate(data, ack.ids)) throw new Error('CURATION_ACK');
   revision.current = ack.revision; renderRevision(ack.revision); return data;
  } catch { if (current(token) && !token.controller.signal.aborted) fail(token); else if (current(token) && !blocked) { setBlocked(true); setStatus(previous => previous.startsWith('Conflict:') ? previous : 'Outcome uncertain. No write will be retried. Retain your drafts and reload to reconcile.'); } return null; }
 }
 function complete(token: Token, clean: boolean) { if (!current(token)) return; active.current = null; dirty.current = !clean; attempted.current = null; setStatus(clean ? 'Confirmed saved. Public visibility depends on content and publication settings.' : 'Submitted change confirmed saved. Other edits remain local; retain drafts before leaving.'); refreshSettingsCopies(); }
 return { draft, setDraft, readDraft: () => latest.current, status, blocked, copies, current, edit, begin, transport, mutate, complete, fail, refresh: refreshSettingsCopies,
  panel: <section aria-label={`${scope} recovery`} className="space-y-3">
   {status && <p role="status">{status}</p>}
   {blocked && <><label className="block">Retained homepage drafts<textarea aria-label="Retained homepage drafts" readOnly value={copies} className="mt-2 min-h-40 w-full bg-black p-3 text-white" /></label><p>Copy all drafts before reloading. Reload reads server state; it does not resubmit a change or restore a draft automatically.</p><label><input type="checkbox" checked={retainedCopy === copies} onChange={event => setRetainedCopy(event.target.checked ? copies : null)} /> I have retained all drafts shown above.</label><button type="button" disabled={retainedCopy !== copies} onClick={() => { if (retainedCopy === readSettingsCopies()) window.location.reload(); }}>Reload to reconcile</button></>}
  </section>,
 };
}
