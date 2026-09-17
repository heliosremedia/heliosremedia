"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PublicSiteSettings } from "@/lib/site-settings";
import { canonicalRevision, type SettingsRevision, type SettingsScope } from "@/lib/site-settings-editor";
import { emptySettingsCopies, readSettingsCopies, refreshSettingsCopies, registerSettingsCopy, subscribeSettingsCopies } from "@/app/admin/settings/settingsDraftCopies";

type Outcome = "idle" | "saving" | "saved" | "conflict" | "uncertain";
type Preparation = (signal: AbortSignal) => Promise<PublicSiteSettings>;
const sameRevision = (a: SettingsRevision, b: SettingsRevision) => a && b &&
  a.id === b.id && a.workspaceId === b.workspaceId && a.storedWorkspaceId === b.storedWorkspaceId && a.updatedAt === b.updatedAt;

function readSettings(value: unknown, template: PublicSiteSettings): PublicSiteSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  // Accept only the existing public DTO keys, never extra response fields.
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(template) as (keyof PublicSiteSettings)[]) {
    const item = row[key], before = template[key];
    if (key === "bookingEstimatedRestoreAt") {
      if (item !== null && !canonicalRevision(item)) return null;
    } else if (Array.isArray(before)) {
      if (!Array.isArray(item) || item.length > 20 || item.some(entry => !entry || typeof entry !== "object" || Array.isArray(entry))) return null;
      const fields = key === "headerNavigation" || key === "footerNavigation" ? ["label", "href"] : ["number", "title", "description"];
      if (item.some(entry => fields.some(field => typeof entry[field] !== "string") || ["published", "newTab", "displayInNav", "displayInFooter"].some(field => entry[field] !== undefined && typeof entry[field] !== "boolean"))) return null;
    } else if (before === null || typeof before === "string") {
      const required = ["id", "businessName", "phoneDisplay", "phoneE164", "bookingMode", "googleReviewDisplayMode", "locationLabel", "serviceArea", "availabilityStatus", "defaultSeoTitle", "defaultSeoDescription"].includes(key);
      if (!(typeof item === "string" || (item === null && !required))) return null;
    } else if (typeof item !== typeof before || (typeof item === "number" && !Number.isFinite(item))) return null;
    result[key] = item;
  }
  if (!["ONLINE", "UNAVAILABLE", "PAUSED"].includes(String(row.bookingMode)) || !["AVAILABLE", "ADVISORY", "CRITICAL"].includes(String(row.availabilityStatus))) return null;
  return result as PublicSiteSettings;
}

export function useSettingsRecovery(initialSettings: PublicSiteSettings, initialRevision: SettingsRevision, scope: SettingsScope) {
  const [settings, renderSettings] = useState(initialSettings);
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [copiedSnapshot, setCopiedSnapshot] = useState<string | null>(null);
  const current = useRef(initialSettings);
  const revision = useRef(initialRevision);
  const admission = useRef(false);
  const active = useRef<{ controller: AbortController; cancelled: boolean } | null>(null);
  const mounted = useRef(true);
  const preserved = useRef<string | null>(null);
  const copies = useSyncExternalStore(subscribeSettingsCopies, readSettingsCopies, emptySettingsCopies);
  const copyPreserved = copiedSnapshot === copies;
  const held = outcome === "conflict" || outcome === "uncertain";
  const saving = outcome === "saving";
  const dirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (active.current) { active.current.cancelled = true; active.current.controller.abort(); } };
  }, []);
  useEffect(() => registerSettingsCopy(current, () => ({ scope, revision: revision.current, settings: current.current })), [scope]);
  useEffect(() => {
    if (!dirty && !saving && !held) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving, held]);

  function setSettings(next: PublicSiteSettings | ((current: PublicSiteSettings) => PublicSiteSettings)) {
    if (!mounted.current || admission.current || current.current !== settings) return;
    current.current = typeof next === "function" ? next(current.current) : next;
    refreshSettingsCopies();
    renderSettings(current.current); setMessage(null); setOutcome("idle");
  }

  async function persist(next: PublicSiteSettings, success = "Settings saved and confirmed.", prepare?: Preparation) {
    if (!mounted.current || admission.current || current.current !== settings) return false;
    admission.current = true;
    const operation = { controller: new AbortController(), cancelled: false };
    active.current = operation;
    const valid = () => mounted.current && active.current === operation && !operation.cancelled;
    const prior = { ...revision.current };
    const requestId = crypto.randomUUID();
    let frozen = JSON.parse(JSON.stringify(next)) as PublicSiteSettings;
    current.current = frozen; renderSettings(frozen);
    refreshSettingsCopies();
    setOutcome("saving"); setMessage("Saving settings…");
    preserved.current = null; setCopiedSnapshot(null);
    async function bounded<T>(work: () => Promise<T>, milliseconds: number): Promise<T> {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([work(), new Promise<never>((_, reject) => {
          timer = setTimeout(() => { operation.cancelled = true; operation.controller.abort(); reject(new Error("SETTINGS_TIMEOUT")); }, milliseconds);
        })]);
      } finally { if (timer !== undefined) clearTimeout(timer); }
    }
    try {
      if (prepare) {
        frozen = JSON.parse(JSON.stringify(await bounded(() => prepare(operation.controller.signal), 600000)));
        if (!valid()) return false;
        current.current = frozen; renderSettings(frozen);
        refreshSettingsCopies();
      }
      const body = scope === "full" ? { ...frozen } : scope === "homepage-navigation"
        ? { updateScope: scope, navigation: frozen.headerNavigation.map(item => ({ ...item, published: true })) }
        : { updateScope: scope, standardPrinciples: frozen.standardPrinciples, approachCards: frozen.approachCards };
      const { response, data } = await bounded(async () => {
        const response = await fetch("/api/admin/site-settings", { method: "PATCH", signal: operation.controller.signal,
          headers: { "Content-Type": "application/json", "x-helios-settings-revision": "1" },
          body: JSON.stringify({ ...body, editorRevision: prior, requestId }),
        });
        return { response, data: await response.json() };
      }, 30000);
      if (!valid()) return false;
      if (response.status === 409) throw new Error("SETTINGS_CONFLICT");
      const ack = data?.acknowledgement;
      const saved = readSettings(data?.settings, initialSettings);
      if (!response.ok || data?.success !== true || ack?.protocol !== 1 || ack.requestId !== requestId || ack.scope !== scope
        || !sameRevision(ack.previousRevision, prior) || !saved || saved.id !== prior.id
        || ack.revision?.id !== prior.id || ack.revision.workspaceId !== prior.workspaceId
        || ack.revision.storedWorkspaceId !== prior.storedWorkspaceId || data.settings.workspaceId !== prior.storedWorkspaceId
        || !canonicalRevision(ack.revision.updatedAt) || data.settings.updatedAt !== ack.revision.updatedAt
        || Date.parse(ack.revision.updatedAt) <= (prior.updatedAt === null ? 0 : Date.parse(prior.updatedAt))) throw new Error("SETTINGS_ACKNOWLEDGEMENT");
      revision.current = { ...ack.revision };
      const confirmed = scope === "full" ? saved : scope === "homepage-navigation"
        ? { ...frozen, headerNavigation: saved.headerNavigation, footerNavigation: saved.footerNavigation }
        : { ...frozen, standardPrinciples: saved.standardPrinciples, approachCards: saved.approachCards };
      current.current = confirmed; renderSettings(confirmed); setSavedSettings(confirmed);
      refreshSettingsCopies();
      setOutcome("saved"); setMessage(success); admission.current = false;
      return true;
    } catch (error) {
      if (!mounted.current || active.current !== operation) return false;
      const conflict = error instanceof Error && error.message === "SETTINGS_CONFLICT";
      setOutcome(conflict ? "conflict" : "uncertain");
      setMessage(conflict ? "Settings changed since this editor was opened. Your changes are retained. Preserve a copy and reload to reconcile."
        : "Save outcome is uncertain. Your changes are retained. Preserve a copy and reload to check saved settings before making another change.");
      return false;
    }
  }

  return { settings, setSettings, savedSettings, dirty, saving, held, message, setMessage, persist,
    recovery: held ? <section className="my-5 min-w-0 rounded-xl border border-amber-300/30 p-4">
      <p role="alert" className="text-sm text-amber-100">{message}</p>
      <p className="mt-3 text-sm">Copy the open settings drafts below before reloading. Compare them with saved settings after reload. Also preserve any changes in other tools on this page. Reload does not retry the write.</p>
      <textarea aria-label="Unsaved settings copy" readOnly value={copies} onFocus={event => event.currentTarget.select()} className="mt-3 h-48 w-full min-w-0 bg-black/30 p-3 font-mono text-xs" />
      <label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" aria-label="I have preserved my settings copy" checked={copyPreserved} onChange={event => { preserved.current = event.target.checked ? copies : null; setCopiedSnapshot(preserved.current); }} />I have preserved my settings copy</label>
      <button type="button" disabled={!copyPreserved} className="admin-btn-secondary" onClick={() => { if (preserved.current !== null && preserved.current === readSettingsCopies()) window.location.reload(); }}>Reload saved settings</button>
    </section> : null };
}
