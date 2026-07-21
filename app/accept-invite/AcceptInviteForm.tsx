"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) return setError("The passwords do not match.");
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/auth/accept-invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to activate this account.");
      router.push("/login?invited=1");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to activate this account."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/35">Password<input type="password" required minLength={12} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label><label className="block text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/35">Confirm password<input type="password" required minLength={12} autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label><p className="text-xs leading-5 text-white/30">Use at least 12 characters with a letter and number.</p>{error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200/80">{error}</p>}<button type="submit" disabled={busy} className="admin-btn-primary w-full rounded-xl">{busy ? "Activating…" : "Activate account"}</button></form>;
}
