"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function DashboardRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="admin-btn-secondary"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
