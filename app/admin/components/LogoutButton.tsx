"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  async function logout() { setBusy(true); try { await fetch("/api/admin/auth/logout", { method: "POST" }); } finally { router.replace("/login"); router.refresh(); } }
  return <button type="button" onClick={logout} disabled={busy} aria-label="Sign out" title="Sign out" className="admin-btn-icon"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4"><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M9 12h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>;
}
