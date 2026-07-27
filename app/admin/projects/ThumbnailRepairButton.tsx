"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ThumbnailRepairButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function repair() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/projects/repair-thumbnails", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to repair thumbnails.");
      setMessage(data.repaired ? `Repaired ${data.repaired} project thumbnail${data.repaired === 1 ? "" : "s"}.` : "All available project thumbnails are already assigned.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to repair thumbnails.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex flex-wrap items-center gap-3">
    <button type="button" disabled={busy} onClick={repair} className="admin-btn-secondary">{busy ? "Repairing…" : "Repair missing thumbnails"}</button>
    {message ? <p role="status" className="text-xs text-white/40">{message}</p> : null}
  </div>;
}
