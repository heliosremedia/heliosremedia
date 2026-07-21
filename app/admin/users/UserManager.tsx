"use client";

import { useState } from "react";
import type { AdminRole } from "@/app/generated/prisma/client";

type User = { id: string; email: string; displayName: string; role: AdminRole; active: boolean; lastLoginAt: string | null; createdAt: string };
type Invitation = { id: string; email: string; displayName: string; role: AdminRole; expiresAt: string; createdAt: string };
const roles: AdminRole[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];

export default function UserManager({ initialUsers, invitations, currentUserId, currentRole }: { initialUsers: User[]; invitations: Invitation[]; currentUserId: string; currentRole: AdminRole }) {
  const [users, setUsers] = useState(initialUsers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("EDITOR");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [password, setPassword] = useState("");

  async function invite(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null); setInviteUrl(null);
    try { const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name, email, role }) }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || "Unable to create invitation."); setInviteUrl(data.invitationUrl); setName(""); setEmail(""); setMessage("Invitation created. Copy the secure link below and send it to the teammate."); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "Unable to create invitation."); }
    finally { setBusy(false); }
  }

  async function update(user: User, patch: { role?: AdminRole; active?: boolean }) {
    setBusy(true); setMessage(null);
    try { const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, ...patch }) }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || "Unable to update user."); setUsers(current => current.map(item => item.id === user.id ? { ...item, ...data.user } : item)); setMessage("Account access updated."); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "Unable to update user."); }
    finally { setBusy(false); }
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault(); if (!resetUser) return; setBusy(true); setMessage(null);
    try { const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: resetUser.id, password }) }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || "Unable to reset password."); const isSelf = resetUser.id === currentUserId; const displayName = resetUser.displayName; setResetUser(null); setPassword(""); if (isSelf) { window.location.assign("/login?passwordReset=1"); return; } setMessage(`Password reset for ${displayName}. Their active sessions were signed out.`); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "Unable to reset password."); }
    finally { setBusy(false); }
  }

  const roleOptions = roles.filter(item => currentRole === "OWNER" || item !== "OWNER");
  return <>
    <div className="grid gap-7 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-6">
        <p className="text-[0.54rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">Invite teammate</p>
        <form onSubmit={invite} className="mt-6 space-y-4">
          <label className="block text-xs text-white/35">Display name<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white" /></label>
          <label className="block text-xs text-white/35">Email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white" /></label>
          <label className="block text-xs text-white/35">Role<select value={role} onChange={event => setRole(event.target.value as AdminRole)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white">{roleOptions.map(item => <option key={item}>{item}</option>)}</select></label>
          <button disabled={busy} className="admin-btn-primary">{busy ? "Creating…" : "Create invitation"}</button>
        </form>
        {inviteUrl && <div className="mt-5 rounded-xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.05] p-4"><p className="text-xs text-white/45">Single-use link · expires in 7 days</p><input readOnly value={inviteUrl} onFocus={event => event.currentTarget.select()} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/65" /><button type="button" onClick={() => navigator.clipboard.writeText(inviteUrl)} className="admin-btn-secondary mt-3">Copy link</button></div>}
        {message && <p role="status" className="mt-5 text-sm text-white/50">{message}</p>}
        {invitations.length > 0 && <div className="mt-7 border-t border-white/[0.08] pt-5"><p className="text-xs uppercase tracking-[0.14em] text-white/25">Pending invitations</p>{invitations.map(item => <p key={item.id} className="mt-3 text-xs text-white/45">{item.displayName} · {item.role}<span className="block text-white/25">{item.email} · expires {new Date(item.expiresAt).toLocaleDateString()}</span></p>)}</div>}
      </section>
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111]">
        <div className="border-b border-white/[0.08] p-6"><h2 className="text-2xl font-light text-white">Workspace accounts</h2><p className="mt-2 text-sm text-white/35">Manage roles, reset passwords, and revoke account access without deleting activity history.</p></div>
        {users.map(user => <article key={user.id} className="grid gap-4 border-b border-white/[0.06] p-5 last:border-0 lg:grid-cols-[minmax(0,1fr)_9rem_auto] lg:items-center"><div className="min-w-0"><p className="truncate text-sm text-white/70">{user.displayName}{user.id === currentUserId ? " · You" : ""}</p><p className="mt-1 truncate text-xs text-white/30">{user.email} · {user.lastLoginAt ? `Last signed in ${new Date(user.lastLoginAt).toLocaleDateString()}` : "Never signed in"}</p></div><select disabled={busy || (user.role === "OWNER" && currentRole !== "OWNER")} value={user.role} onChange={event => update(user, { role: event.target.value as AdminRole })} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-xs text-white">{roleOptions.map(item => <option key={item}>{item}</option>)}</select><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || (user.role === "OWNER" && currentRole !== "OWNER")} onClick={() => { setResetUser(user); setPassword(""); setMessage(null); }} className="admin-btn-secondary">Reset password</button><button type="button" disabled={busy || user.id === currentUserId || (user.role === "OWNER" && currentRole !== "OWNER")} onClick={() => update(user, { active: !user.active })} className={user.active ? "admin-btn-danger" : "admin-btn-secondary"}>{user.active ? "Deactivate" : "Reactivate"}</button></div></article>)}
      </section>
    </div>
    {resetUser && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reset-password-title"><form onSubmit={resetPassword} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141414] p-6"><p className="eyebrow text-[var(--helios-orange)]">Account security</p><h2 id="reset-password-title" className="mt-3 text-2xl font-light text-white">Reset {resetUser.displayName}&apos;s password</h2><p className="mt-3 text-sm leading-6 text-white/40">Set a temporary password of at least 12 characters. All existing sessions for this account will be signed out.</p><label className="mt-5 block text-xs text-white/40">New password<input autoFocus required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white" /></label><div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => { setResetUser(null); setPassword(""); }} className="admin-btn-secondary">Cancel</button><button disabled={busy || password.length < 12} className="admin-btn-primary">{busy ? "Resetting…" : "Reset password"}</button></div></form></div>}
  </>;
}
