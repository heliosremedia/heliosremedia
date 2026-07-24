"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Client = {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  lastSyncedAt: string;
};

export default function ClientDirectory({
  initialClients,
  canSync,
}: {
  initialClients: Client[];
  canSync: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const clients = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return initialClients;
    return initialClients.filter((client) =>
      [client.displayName, client.email, client.phone || ""].some((value) =>
        value.toLowerCase().includes(search),
      ),
    );
  }, [initialClients, query]);

  async function syncClients() {
    setSyncing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/clients/sync", { method: "POST" });
      const result = (await response.json()) as {
        success?: boolean;
        total?: number;
        created?: number;
        updated?: number;
        error?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Clients could not be synchronized.");
      }
      setMessage(
        `${result.total} clients synced · ${result.created} new · ${result.updated} updated`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Clients could not be synchronized.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-white/65">{initialClients.length} clients</p>
          <p className="mt-1 text-xs text-white/30">
            Manual sync imports name, email, and phone from HDPhotoHub.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          {canSync ? (
            <button
              type="button"
              onClick={syncClients}
              disabled={syncing}
              className="admin-btn-primary"
            >
              {syncing ? "Syncing clients…" : "Sync clients"}
            </button>
          ) : null}
          {message ? <p role="status" className="text-xs text-white/45">{message}</p> : null}
        </div>
      </section>

      <label className="block">
        <span className="sr-only">Search clients</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, email, or phone"
          className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[var(--helios-orange)]/50"
        />
      </label>

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(10rem,0.7fr)] gap-5 border-b border-white/[0.08] px-6 py-4 text-[0.62rem] uppercase tracking-[0.16em] text-white/30 md:grid">
          <span>Name</span><span>Email</span><span>Phone</span>
        </div>
        {clients.length ? (
          <div className="divide-y divide-white/[0.07]">
            {clients.map((client) => (
              <article key={client.id} className="grid gap-3 px-6 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(10rem,0.7fr)] md:items-center md:gap-5">
                <p className="truncate text-sm text-white/75">{client.displayName}</p>
                <a href={`mailto:${client.email}`} className="truncate text-sm text-white/45 transition hover:text-white">{client.email}</a>
                <p className="text-sm text-white/45">{client.phone || "—"}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="px-6 py-12 text-center text-sm text-white/35">
            {query ? "No clients match that search." : "No clients yet. Run the first HDPhotoHub sync."}
          </p>
        )}
      </section>
    </div>
  );
}
