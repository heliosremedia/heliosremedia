"use client";

import { useState } from "react";
import type { AdminRole } from "@/app/generated/prisma/client";
import { getAccountIdentity } from "@/lib/workspace-account-policy";

type User = { id: string; email: string; displayName: string; title: string | null; role: AdminRole; active: boolean; lastLoginAt: string | null; createdAt: string };
type Invitation = { id: string; email: string; displayName: string; title: string | null; role: AdminRole; expiresAt: string; createdAt: string };
const roles: AdminRole[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];

export default function UserManager({ initialUsers, invitations, currentUserId, currentRole }: { initialUsers: User[]; invitations: Invitation[]; currentUserId: string; currentRole: AdminRole }) {
  const [users, setUsers] = useState(initialUsers);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("EDITOR");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [password, setPassword] = useState("");

  async function invite(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null); setInviteUrl(null);
    try { const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name, title, email, role }) }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || "Unable to create invitation."); setInviteUrl(data.invitationUrl); setName(""); setTitle(""); setEmail(""); setMessage("Invitation created. Copy the secure link below and send it to the teammate."); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "Unable to create invitation."); }
    finally { setBusy(false); }
  }

  async function update(user: User, patch: { role?: AdminRole; active?: boolean }) {
    if (!window.confirm(patch.role ? `Change ${user.displayName}'s role to ${patch.role}?` : `${patch.active ? "Reactivate" : "Deactivate"} ${user.displayName}?`)) return;
    setBusy(true); setMessage(null);
    try { const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, ...patch }) }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || "Unable to update user."); setUsers(current => current.map(item => item.id === user.id ? { ...item, ...data.user } : item)); setMessage("Account access updated."); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "Unable to update user."); }
    finally { setBusy(false); }
  }

  async function updateTitle(user: User, nextTitle: string) {
    setBusy(true); setMessage(null);
    try { const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, title: nextTitle }) }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || "Unable to update title."); setUsers(current => current.map(item => item.id === user.id ? { ...item, title: data.user.title } : item)); setMessage("Professional title updated. Account permissions were unchanged."); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "Unable to update title."); }
    finally { setBusy(false); }
  }

  async function revokeInvitation(invitationId: string) {
    if (!window.confirm("Revoke this pending invitation? The current link will stop working.")) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invitationId }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to revoke invitation.");
      setMessage("Invitation revoked. Refreshing…"); window.location.reload();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Unable to revoke invitation."); setBusy(false); }
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
          <label className="block text-xs text-white/35">Professional title<input maxLength={120} value={title} onChange={event => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white" /><span className="mt-2 block text-[0.68rem] leading-5 text-white/25">Public-facing identity; separate from the permission role below.</span></label>
          <label className="block text-xs text-white/35">Email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white" /></label>
          <label className="block text-xs text-white/35">Permission role<select value={role} onChange={event => setRole(event.target.value as AdminRole)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white">{roleOptions.map(item => <option key={item}>{item}</option>)}</select><span className="mt-2 block text-[0.68rem] leading-5 text-white/25">Controls Studio access; it is never shown as a public project credit.</span></label>
          <button disabled={busy} className="admin-btn-primary">{busy ? "Creating…" : "Create invitation"}</button>
        </form>
        {inviteUrl && <div className="mt-5 rounded-xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.05] p-4"><p className="text-xs text-white/45">Single-use link · expires in 7 days</p><input readOnly value={inviteUrl} onFocus={event => event.currentTarget.select()} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/65" /><button type="button" onClick={() => navigator.clipboard.writeText(inviteUrl)} className="admin-btn-secondary mt-3">Copy link</button></div>}
        {message && <p role="status" className="mt-5 text-sm text-white/50">{message}</p>}
        {invitations.length > 0 && <div className="mt-7 border-t border-white/[0.08] pt-5"><p className="text-xs uppercase tracking-[0.14em] text-white/25">Invitations</p>{invitations.map(item => { const expired=new Date(item.expiresAt)<=new Date(); return <div key={item.id} className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] p-3"><p className="text-xs text-white/45">{item.displayName} · {item.role}<span className="block text-white/25">{item.email} · {expired?"Expired":`expires ${new Date(item.expiresAt).toLocaleDateString()}`}</span></p><button type="button" disabled={busy} onClick={()=>revokeInvitation(item.id)} className="admin-btn-link">Revoke</button></div>;})}</div>}
      </section>
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111]">
        <div className="border-b border-white/[0.08] p-6"><h2 className="text-2xl font-light text-white">Workspace accounts</h2><p className="mt-2 text-sm text-white/35">Manage roles, reset passwords, and revoke account access without deleting activity history.</p></div>
        <div className="divide-y divide-white/[0.06]">
          {users.map(user => {
            const identity = getAccountIdentity(user.displayName, user.title);
            const isOwner = user.role === "OWNER";
            const roleControlId = `permission-role-${user.id}`;
            const titleControlId = `professional-title-${user.id}`;
            const ownerReasonId = `owner-protection-${user.id}`;
            const canResetPassword = currentRole === "OWNER" || user.id === currentUserId;
            return (
              <article
                key={user.id}
                aria-busy={busy}
                className="grid min-w-0 gap-4 p-5 sm:p-6 xl:grid-cols-[minmax(11rem,1.05fr)_minmax(12rem,0.95fr)_minmax(8.5rem,0.55fr)_auto] xl:items-end"
              >
                <div className="min-w-0 self-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words text-base font-medium leading-6 text-white/85">
                      {identity.displayName}
                    </h3>
                    {user.id === currentUserId && <span className="rounded-full border border-[var(--helios-orange)]/25 bg-[var(--helios-orange)]/[0.06] px-2 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.12em] text-[var(--helios-orange)]">You</span>}
                    {!user.active && <span className="rounded-full border border-white/10 px-2 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.12em] text-white/35">Inactive</span>}
                  </div>
                  <a href={`mailto:${user.email}`} className="mt-1 block break-all text-sm text-white/45 transition hover:text-white focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)]">
                    {user.email}
                  </a>
                  <p className="mt-2 text-xs leading-5 text-white/25">
                    {user.lastLoginAt ? `Last signed in ${new Date(user.lastLoginAt).toLocaleDateString()}` : "Never signed in"}
                  </p>
                </div>

                <label htmlFor={titleControlId} className="min-w-0 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-white/30">
                  Professional title
                  <input
                    id={titleControlId}
                    defaultValue={user.title || ""}
                    placeholder="Not provided"
                    maxLength={120}
                    disabled={busy}
                    title={user.title || "No professional title provided"}
                    onBlur={event => {
                      if (event.currentTarget.value.trim() !== (user.title || "")) void updateTitle(user, event.currentTarget.value.trim());
                    }}
                    className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-normal normal-case leading-5 tracking-normal text-white outline-none placeholder:text-white/25 focus:border-[var(--helios-orange)] focus:ring-1 focus:ring-[var(--helios-orange)]"
                  />
                  <span className="mt-1.5 block text-[0.66rem] font-normal normal-case leading-4 tracking-normal text-white/25">Public-facing credit</span>
                </label>

                <label htmlFor={roleControlId} className="min-w-0 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-white/30">
                  Permission role
                  <select
                    id={roleControlId}
                    aria-describedby={isOwner ? ownerReasonId : undefined}
                    disabled={busy || isOwner}
                    value={user.role}
                    onChange={event => update(user, { role: event.target.value as AdminRole })}
                    className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-normal tracking-normal text-white outline-none focus:border-[var(--helios-orange)] focus:ring-1 focus:ring-[var(--helios-orange)] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {roles.map(item => <option key={item} disabled={item === "OWNER" && currentRole !== "OWNER"}>{item}</option>)}
                  </select>
                  <span className="mt-1.5 block text-[0.66rem] font-normal normal-case leading-4 tracking-normal text-white/25">Administrative access</span>
                </label>

                <div className="flex min-w-0 flex-wrap gap-2 xl:justify-end">
                  <button
                    type="button"
                    disabled={busy || !canResetPassword}
                    title={!canResetPassword ? "Only an owner can reset another user's password." : undefined}
                    onClick={() => { setResetUser(user); setPassword(""); setMessage(null); }}
                    className="admin-btn-secondary h-11! min-h-11!"
                  >
                    Reset password
                  </button>
                  <button
                    type="button"
                    aria-describedby={isOwner ? ownerReasonId : undefined}
                    disabled={busy || isOwner || user.id === currentUserId}
                    title={isOwner ? "The workspace owner cannot be deactivated." : user.id === currentUserId ? "You cannot deactivate your own account." : undefined}
                    onClick={() => update(user, { active: !user.active })}
                    className={`${user.active ? "admin-btn-danger" : "admin-btn-secondary"} h-11! min-h-11!`}
                  >
                    {user.active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
                {isOwner && <p id={ownerReasonId} className="text-xs leading-5 text-[var(--helios-orange)]/65 xl:col-start-2 xl:col-span-3">The workspace owner cannot be deactivated or demoted here. Use the ownership transfer workflow to change ownership.</p>}
              </article>
            );
          })}
        </div>
      </section>
    </div>
    {resetUser && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reset-password-title"><form onSubmit={resetPassword} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141414] p-6"><p className="eyebrow text-[var(--helios-orange)]">Account security</p><h2 id="reset-password-title" className="mt-3 text-2xl font-light text-white">Reset {resetUser.displayName}&apos;s password</h2><p className="mt-3 text-sm leading-6 text-white/40">Set a temporary password of at least 12 characters. All existing sessions for this account will be signed out.</p><label className="mt-5 block text-xs text-white/40">New password<input autoFocus required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white" /></label><div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => { setResetUser(null); setPassword(""); }} className="admin-btn-secondary">Cancel</button><button disabled={busy || password.length < 12} className="admin-btn-primary">{busy ? "Resetting…" : "Reset password"}</button></div></form></div>}
  </>;
}
