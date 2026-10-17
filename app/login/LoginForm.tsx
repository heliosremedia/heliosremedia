"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok || data?.success !== true) {
        setError(typeof data?.error === "string" ? data.error : "Sign-in could not be confirmed. Please try again.");
        submitting.current = false;
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
      // Keep the form locked while the authenticated destination is loading.
    } catch {
      setError("Sign-in could not be confirmed. Check your connection and try again.");
      submitting.current = false;
      setBusy(false);
    }
  }
  return <form aria-busy={busy} onSubmit={submit} className="mt-8 space-y-5"><label className="block text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/35">Email<input disabled={busy} type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label><label className="block text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/35">Password<input disabled={busy} type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>{error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200/80">{error}</p>}<button type="submit" disabled={busy} className="admin-btn-primary w-full rounded-xl">{busy ? "Signing in…" : "Enter workspace"}</button></form>;
}
