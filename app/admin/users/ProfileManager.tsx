"use client";

import { useState } from "react";

type Profile = {
  firstName: string | null; lastName: string | null; displayName: string;
  email: string; phone: string | null;
  notificationPreferences: unknown;
};

const field = "mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-[var(--helios-orange)]";

export default function ProfileManager({ initialProfile }: { initialProfile: Profile }) {
  const preferences = initialProfile.notificationPreferences && typeof initialProfile.notificationPreferences === "object"
    ? initialProfile.notificationPreferences as Record<string, boolean> : {};
  const [form, setForm] = useState({
    firstName: initialProfile.firstName || "", lastName: initialProfile.lastName || "",
    displayName: initialProfile.displayName, email: initialProfile.email, phone: initialProfile.phone || "",
    currentPassword: "", newPassword: "",
    security: preferences.security !== false, invitations: preferences.invitations !== false,
    publishing: preferences.publishing !== false, operations: preferences.operations !== false,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const patch = (key: keyof typeof form, value: string | boolean) => setForm(current => ({ ...current, [key]: value }));

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, notificationPreferences: { security: form.security, invitations: form.invitations, publishing: form.publishing, operations: form.operations } }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Your profile could not be saved.");
      if (data.signedOut) { window.location.assign("/login?profileUpdated=1"); return; }
      setForm(current => ({ ...current, currentPassword: "", newPassword: "" }));
      setMessage({ ok: true, text: "Your profile and notification preferences were saved." });
    } catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : "Your profile could not be saved." }); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-6">
    <p className="text-[0.54rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">Your profile</p>
    <h2 className="mt-2 text-2xl font-light text-white">Personal account</h2>
    <p className="mt-2 text-sm leading-6 text-white/35">Changing your email or password requires your current password and signs out existing sessions.</p>
    <form onSubmit={save} className="mt-6 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-white/35">First name<input value={form.firstName} onChange={e=>patch("firstName",e.target.value)} className={field}/></label>
        <label className="text-xs text-white/35">Last name<input value={form.lastName} onChange={e=>patch("lastName",e.target.value)} className={field}/></label>
      </div>
      <label className="block text-xs text-white/35">Display name<input required value={form.displayName} onChange={e=>patch("displayName",e.target.value)} className={field}/></label>
      <label className="block text-xs text-white/35">Email address<input required type="email" value={form.email} onChange={e=>patch("email",e.target.value)} className={field}/></label>
      <label className="block text-xs text-white/35">Phone number<input type="tel" value={form.phone} onChange={e=>patch("phone",e.target.value)} className={field}/></label>
      <fieldset className="rounded-xl border border-white/[0.07] p-4"><legend className="px-2 text-xs text-white/35">Notifications</legend><div className="grid gap-3 sm:grid-cols-2">{([["security","Security alerts"],["invitations","Invitations"],["publishing","Publishing activity"],["operations","Operational incidents"]] as const).map(([key,label])=><label key={key} className="flex items-center gap-3 text-sm text-white/50"><input type="checkbox" checked={form[key]} onChange={e=>patch(key,e.target.checked)}/>{label}</label>)}</div></fieldset>
      <div className="grid gap-4 border-t border-white/[0.07] pt-5 sm:grid-cols-2">
        <label className="text-xs text-white/35">Current password<input type="password" autoComplete="current-password" value={form.currentPassword} onChange={e=>patch("currentPassword",e.target.value)} className={field}/></label>
        <label className="text-xs text-white/35">New password <span className="text-white/20">(optional)</span><input type="password" minLength={12} autoComplete="new-password" value={form.newPassword} onChange={e=>patch("newPassword",e.target.value)} className={field}/></label>
      </div>
      {message&&<p role="status" className={`text-sm ${message.ok?"text-emerald-300":"text-red-300"}`}>{message.text}</p>}
      <button disabled={busy} className="admin-btn-primary">{busy?"Saving…":"Save my profile"}</button>
    </form>
  </section>;
}
