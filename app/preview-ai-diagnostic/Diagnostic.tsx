"use client";
import { useState } from "react";

export default function Diagnostic() {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Record<string, { imageDataUrl?: string; [key: string]: unknown }>>({});
  async function run(kind: "text" | "location" | "grounding" | "image") {
    if (busy || results[kind]) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/preview-ai-diagnostic?kind=${kind}`, { method: "POST", credentials: "same-origin" });
      const result = await response.json();
      setResults(previous => ({ ...previous, [kind]: result }));
    } catch { setResults(previous => ({ ...previous, [kind]: { error: "Request failed; do not retry blindly" } })); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-4xl p-8 text-white">
    <h1 className="text-2xl">Temporary preview AI diagnostics</h1>
    <p className="my-4">Admin-only synthetic tests. Each button makes one paid provider request. No database, asset storage, emails, publishing or other shared-storage writes. Results exist only in this page. Image cost must be checked from returned usage; token prices alone do not establish per-image cost.</p>
    {(["text", "location", "grounding", "image"] as const).map(kind => <section key={kind} className="my-6">
      <button className="rounded border p-3 disabled:opacity-50" disabled={busy || !!results[kind]} onClick={() => void run(kind)}>Run {kind === "text" ? "Luna writing strict JSON (default reasoning)" : kind === "location" ? "Luna factual location copy" : kind === "grounding" ? "Luna strict JSON (no reasoning, grounding settings)" : "Flare medium 1536×1024 image"} test once</button>
      {results[kind] && <><pre className="my-4 whitespace-pre-wrap break-words">{JSON.stringify({ ...results[kind], imageDataUrl: results[kind].imageDataUrl ? "[rendered below, not stored]" : undefined }, null, 2)}</pre>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {results[kind].imageDataUrl && <img src={results[kind].imageDataUrl} alt="Synthetic generated living room for quality review" className="w-full" />}</>}
    </section>)}
    {busy && <p role="status">Waiting for provider response. Do not reload or repeat.</p>}
  </main>;
}
