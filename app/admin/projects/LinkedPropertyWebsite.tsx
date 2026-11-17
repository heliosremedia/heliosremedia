"use client";
import { useState } from "react";

export default function LinkedPropertyWebsite({ projectId, siteId, hasValue, onApply }: { projectId: string; siteId: number; hasValue: boolean; onApply: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    if (busy || hasValue) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/projects/hdph-import?siteId=${siteId}&targetProjectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error("The linked property could not be checked. Try again or enter the link manually.");
      if (!data.propertyWebsiteUrl) throw new Error("HDPhotoHub does not report an eligible property website for this linked property. You can enter a verified link manually.");
      const url = new URL(data.propertyWebsiteUrl);
      if (url.origin !== "https://heliosrealestatemedia.hd.pics" || url.pathname !== "/view/" || url.searchParams.get("s") !== String(siteId) || url.username || url.password) throw new Error("The returned property link could not be verified.");
      onApply(url.href);
      setMessage("Review the website field, then Save details. Existing entries are kept; nothing was saved or published automatically.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The property link could not be loaded."); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 flex flex-col items-start gap-2"><button type="button" className="admin-btn-secondary" disabled={busy || hasValue} onClick={() => void load()}>{busy ? "Checking HDPhotoHub…" : "Use linked HDPhotoHub website"}</button><p className="text-xs text-white/45">Fills an empty field only. Review and save when ready.</p>{message && <p role="status" className="text-xs leading-5 text-white/60">{message}</p>}</div>;
}
