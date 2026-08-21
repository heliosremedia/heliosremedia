"use client";

import { useState } from "react";

export type GoogleLocationOption = { accountResourceName: string; accountDisplayName: string; locationResourceName: string; locationTitle: string; locationAddress: string | null };
export type GoogleConnectionState = {
  oauthConfigured: boolean;
  databaseReady: boolean;
  authorized: boolean;
  connection: null | { status: string; accountDisplayName: string | null; locationResourceName: string | null; locationTitle: string | null; locationAddress: string | null; availableLocations: GoogleLocationOption[]; lastSyncAt: string | null; lastSyncStatus: string | null; lastSyncError: string | null; connectedAt: string | null };
  reviews: Array<{ id: string; reviewerName: string; reviewerPhotoUrl: string | null; starRating: number; reviewText: string | null; reviewCreatedAt: string | null; businessReplyText: string | null; lastSyncedAt: string; syncStatus: string; testimonialId: string | null }>;
};

function statusText(state: GoogleConnectionState) {
  if (!state.databaseReady) return "Preview database migration pending";
  if (!state.oauthConfigured) return "OAuth credentials required";
  if (!state.connection) return "Not connected";
  if (state.connection.status === "CONNECTED") return "Connected";
  if (state.connection.status === "NEEDS_LOCATION") return "Location selection required";
  return "Attention required";
}

export default function GoogleBusinessConnectionPanel({ initialState, callbackMessage }: { initialState: GoogleConnectionState; callbackMessage?: string }) {
  const [state] = useState(initialState);
  const [location, setLocation] = useState(state.connection?.locationResourceName || "");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState(callbackMessage || "");
  const [error, setError] = useState("");

  async function request(url: string, options: RequestInit) {
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
    const data = await response.json() as { success?: boolean; error?: string; result?: { imported: number; updated: number } };
    if (!response.ok || data.success !== true) throw new Error(data.error || "The request could not be completed.");
    return data;
  }

  async function saveLocation() {
    setBusy("location"); setError(""); setMessage("");
    try { await request("/api/admin/integrations/google-business", { method: "PATCH", body: JSON.stringify({ locationResourceName: location }) }); setMessage("Google Business Profile location connected."); window.location.reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The location could not be saved."); setBusy(null); }
  }

  async function sync() {
    setBusy("sync"); setError(""); setMessage("");
    try { const data = await request("/api/admin/testimonials/google-sync", { method: "POST" }); const result = data.result!; setMessage(`${result.imported} new review${result.imported === 1 ? "" : "s"} imported and ${result.updated} refreshed.`); window.location.reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Reviews could not be synchronized."); setBusy(null); }
  }

  async function curate(reviewId: string) {
    setBusy(reviewId); setError(""); setMessage("");
    try { await request(`/api/admin/integrations/google-business/reviews/${encodeURIComponent(reviewId)}/curate`, { method: "POST" }); setMessage("Review added as an unpublished Featured Google Review draft."); window.location.reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The review could not be added."); setBusy(null); }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Google Business Profile? Stored Google authorization and imported review source records will be removed. Published Featured Google Reviews will remain.")) return;
    setBusy("disconnect"); setError(""); setMessage("");
    try { await request("/api/admin/integrations/google-business", { method: "DELETE" }); setMessage("Google Business Profile disconnected."); window.location.reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Google Business Profile could not be disconnected."); setBusy(null); }
  }

  const connected = state.connection?.status === "CONNECTED";
  const locations = state.connection?.availableLocations ?? [];
  return <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7" aria-labelledby="google-business-heading">
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div><p className="eyebrow text-[var(--helios-orange)]">Google Business Profile</p><h2 id="google-business-heading" className="mt-2 text-2xl font-light text-white">Review connection</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/38">Connect one company location, synchronize reviews manually, then choose which reviews become unpublished Featured Google Review drafts.</p></div>
      <div className="lg:text-right"><p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/35">{statusText(state)}</p>{state.connection?.locationTitle && <p className="mt-2 text-sm text-white/65">{state.connection.locationTitle}</p>}{state.connection?.locationAddress && <p className="mt-1 text-xs text-white/30">{state.connection.locationAddress}</p>}</div>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200/80">{error}</p>}
    {message && <p role="status" aria-live="polite" className="mt-5 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] p-4 text-sm text-emerald-100/65">{message}</p>}

    {locations.length > 1 && !connected && <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="text-xs text-white/40">Google Business Profile location<select value={location} onChange={(event) => setLocation(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--helios-orange)]"><option value="">Select a location</option>{locations.map((option) => <option key={option.locationResourceName} value={option.locationResourceName}>{option.locationTitle}{option.locationAddress ? ` · ${option.locationAddress}` : ""}</option>)}</select></label><button type="button" onClick={saveLocation} disabled={!location || busy !== null} className="admin-btn-primary self-end">{busy === "location" ? "Saving…" : "Use location"}</button></div>}

    <div className="mt-6 flex flex-wrap gap-3 border-t border-white/[0.08] pt-6">
      {!state.connection && <a href="/api/admin/integrations/google-business/start" aria-disabled={!state.oauthConfigured || !state.databaseReady || !state.authorized} onClick={(event) => { if (!state.oauthConfigured || !state.databaseReady || !state.authorized) event.preventDefault(); }} className={`admin-btn-primary ${!state.oauthConfigured || !state.databaseReady || !state.authorized ? "pointer-events-none opacity-40" : ""}`}>Connect Google Business Profile</a>}
      {connected && <button type="button" onClick={sync} disabled={busy !== null || !state.authorized} className="admin-btn-primary">{busy === "sync" ? "Syncing…" : "Sync reviews"}</button>}
      {state.connection && <button type="button" onClick={disconnect} disabled={busy !== null || !state.authorized} className="admin-btn-secondary">{busy === "disconnect" ? "Disconnecting…" : "Disconnect"}</button>}
    </div>
    {!state.authorized && <p className="mt-4 text-xs leading-5 text-amber-100/55">Owner or administrator access is required to manage this connection.</p>}
    {!state.oauthConfigured && <p className="mt-4 text-xs leading-5 text-white/30">Protected OAuth environment variables must be configured before connection can begin. No credential should be pasted into Helios Studio or chat.</p>}
    {state.connection?.lastSyncAt && <p className="mt-4 text-xs text-white/25">Last successful synchronization: {new Date(state.connection.lastSyncAt).toLocaleString()}</p>}
    {state.connection?.lastSyncError && <p role="alert" className="mt-3 text-xs leading-5 text-red-200/65">{state.connection.lastSyncError}</p>}

    {state.reviews.length > 0 && <div className="mt-8 border-t border-white/[0.08] pt-7"><div><h3 className="text-xl font-light text-white">Imported reviews</h3><p className="mt-2 text-sm text-white/30">Imported source records stay private until you create and publish a curated testimonial.</p></div><div className="mt-5 grid gap-3 lg:grid-cols-2">{state.reviews.map((review) => <article key={review.id} className="rounded-xl border border-white/[0.08] bg-black/20 p-5"><div className="flex items-start justify-between gap-3"><div><h4 className="text-sm text-white/75">{review.reviewerName}</h4><p aria-label={`${review.starRating} out of 5 stars`} className="mt-1 text-xs text-[var(--helios-orange)]">{"★".repeat(review.starRating)}<span className="text-white/15">{"★".repeat(5 - review.starRating)}</span></p></div><span className="rounded-full border border-white/10 px-2 py-1 text-[0.48rem] uppercase tracking-[0.12em] text-white/30">{review.testimonialId ? "Draft created" : "Private"}</span></div><p className="mt-4 line-clamp-4 text-sm leading-6 text-white/45">{review.reviewText || "Rating without written review"}</p>{review.businessReplyText && <p className="mt-3 border-l border-white/10 pl-3 text-xs leading-5 text-white/28">Business reply: {review.businessReplyText}</p>}<button type="button" disabled={Boolean(review.testimonialId) || busy !== null || !review.reviewText} onClick={() => curate(review.id)} className="admin-btn-secondary mt-5">{busy === review.id ? "Creating…" : review.testimonialId ? "Draft created" : "Create curated draft"}</button></article>)}</div></div>}
  </section>;
}
