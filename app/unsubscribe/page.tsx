"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function UnsubscribeForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"READY" | "BUSY" | "DONE" | "ERROR">("READY");
  async function unsubscribe() {
    setState("BUSY");
    const response = await fetch("/api/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    setState(response.ok ? "DONE" : "ERROR");
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#0b0b0b] px-6 text-white"><section className="w-full max-w-xl border border-white/10 bg-[#121211] p-10 text-center"><p className="eyebrow text-[var(--helios-orange)]">Helios Real Estate Media</p><h1 className="mt-5 font-display text-4xl font-light">Email preferences</h1>{state === "DONE" ? <p className="mt-6 text-white/55">You have been unsubscribed from Helios marketing emails.</p> : <><p className="mt-6 text-sm leading-7 text-white/45">You can stop receiving event announcements, company updates, and special offers at any time.</p>{state === "ERROR" && <p className="mt-4 text-sm text-red-300">This link is invalid or the request could not be completed.</p>}<button disabled={!token || state === "BUSY"} onClick={unsubscribe} className="admin-btn-primary mt-8">{state === "BUSY" ? "Updating…" : "Unsubscribe"}</button></>}</section></main>;
}

export default function UnsubscribePage() {
  return <Suspense><UnsubscribeForm /></Suspense>;
}
