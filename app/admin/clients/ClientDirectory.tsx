"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Client = {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  lastSyncedAt: string;
  groupIds: string[];
};

type Group = {
  id: string;
  name: string;
  clientCount: number;
};

const PAGE_SIZE = 50;

export default function ClientDirectory({
  initialClients,
  initialGroups,
  canManage,
}: {
  initialClients: Client[];
  initialGroups: Group[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editingName, setEditingName] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const clients = useMemo(() => {
    const search = query.trim().toLowerCase();
    return initialClients.filter((client) => {
      const matchesSearch =
        !search ||
        [client.displayName, client.email, client.phone || ""].some((value) =>
          value.toLowerCase().includes(search),
        );
      const matchesGroup =
        groupFilter === "all" ||
        (groupFilter === "ungrouped"
          ? client.groupIds.length === 0
          : client.groupIds.includes(groupFilter));
      return matchesSearch && matchesGroup;
    });
  }, [groupFilter, initialClients, query]);

  const pageCount = Math.max(1, Math.ceil(clients.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleClients = clients.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const visibleIds = visibleClients.map((client) => client.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  async function request(
    url: string,
    options: RequestInit,
    fallback: string,
  ) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...options.headers },
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        changed?: number;
      };
      if (!response.ok || !result.success) throw new Error(result.error || fallback);
      router.refresh();
      return result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : fallback);
      return null;
    } finally {
      setBusy(false);
    }
  }

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

  async function createGroup(event: React.FormEvent) {
    event.preventDefault();
    const result = await request(
      "/api/admin/client-groups",
      { method: "POST", body: JSON.stringify({ name: newGroupName }) },
      "The group could not be created.",
    );
    if (result) {
      setNewGroupName("");
      setMessage("Group created.");
    }
  }

  async function renameGroup(event: React.FormEvent) {
    event.preventDefault();
    if (!editingGroup) return;
    const result = await request(
      "/api/admin/client-groups",
      {
        method: "PATCH",
        body: JSON.stringify({ groupId: editingGroup.id, name: editingName }),
      },
      "The group could not be renamed.",
    );
    if (result) {
      setEditingGroup(null);
      setEditingName("");
      setMessage("Group renamed.");
    }
  }

  async function deleteGroup(group: Group) {
    if (
      !window.confirm(
        `Delete "${group.name}"? Its ${group.clientCount} membership${group.clientCount === 1 ? "" : "s"} will be removed, but no client records will be deleted.`,
      )
    ) return;
    const result = await request(
      "/api/admin/client-groups",
      { method: "DELETE", body: JSON.stringify({ groupId: group.id }) },
      "The group could not be deleted.",
    );
    if (result) {
      setEditingGroup(null);
      setEditingName("");
      if (groupFilter === group.id) setGroupFilter("all");
      if (selectedGroupId === group.id) setSelectedGroupId("");
      setMessage("Group deleted. Client records were preserved.");
    }
  }

  async function updateMembership(operation: "add" | "remove") {
    if (!selectedGroupId || !selected.size) return;
    const result = await request(
      "/api/admin/client-groups/memberships",
      {
        method: "PATCH",
        body: JSON.stringify({
          groupId: selectedGroupId,
          clientIds: [...selected],
          operation,
        }),
      },
      "Group membership could not be updated.",
    );
    if (result) {
      setMessage(
        `${result.changed} client${result.changed === 1 ? "" : "s"} ${operation === "add" ? "added to" : "removed from"} the group.`,
      );
      setSelected(new Set());
    }
  }

  function toggleClient(clientId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  const start = clients.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(currentPage * PAGE_SIZE, clients.length);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-white/65">{initialClients.length} clients</p>
          <p className="mt-1 text-xs text-white/30">
            Manual sync imports name, email, and phone. Helios groups stay intact.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          {canManage ? (
            <button
              type="button"
              onClick={syncClients}
              disabled={syncing || busy}
              className="admin-btn-primary"
            >
              {syncing ? "Syncing clients…" : "Sync clients"}
            </button>
          ) : null}
          {message ? <p role="status" className="text-xs text-white/45">{message}</p> : null}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70">Client groups</p>
              <p className="mt-1 text-xs text-white/30">{initialGroups.length} custom groups</p>
            </div>
          </div>

          <div className="mt-5 space-y-1">
            <button
              type="button"
              onClick={() => {
                setGroupFilter("all");
                setPage(1);
                setSelected(new Set());
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${groupFilter === "all" ? "bg-white/[0.08] text-white" : "text-white/45 hover:bg-white/[0.04] hover:text-white/70"}`}
            >
              <span>All clients</span><span className="text-xs text-white/25">{initialClients.length}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGroupFilter("ungrouped");
                setPage(1);
                setSelected(new Set());
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${groupFilter === "ungrouped" ? "bg-white/[0.08] text-white" : "text-white/45 hover:bg-white/[0.04] hover:text-white/70"}`}
            >
              <span>Ungrouped</span>
              <span className="text-xs text-white/25">
                {initialClients.filter((client) => !client.groupIds.length).length}
              </span>
            </button>
            {initialGroups.map((group) => (
              <div key={group.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setGroupFilter(group.id);
                    setPage(1);
                    setSelected(new Set());
                  }}
                  className={`flex min-w-0 flex-1 items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${groupFilter === group.id ? "bg-white/[0.08] text-white" : "text-white/45 hover:bg-white/[0.04] hover:text-white/70"}`}
                >
                  <span className="truncate">{group.name}</span>
                  <span className="ml-2 text-xs text-white/25">{group.clientCount}</span>
                </button>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGroup(group);
                      setEditingName(group.name);
                    }}
                    className="rounded-md px-2 py-1 text-xs text-white/20 opacity-0 transition hover:text-white group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Edit ${group.name}`}
                  >
                    •••
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {canManage ? (
            <form onSubmit={createGroup} className="mt-5 border-t border-white/[0.08] pt-5">
              <label className="block text-[0.58rem] uppercase tracking-[0.14em] text-white/30">
                New group
                <input
                  value={newGroupName}
                  onChange={(event) => setNewGroupName(event.target.value)}
                  maxLength={80}
                  placeholder="VIP Clients"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm normal-case tracking-normal text-white outline-none placeholder:text-white/20 focus:border-[var(--helios-orange)]/50"
                />
              </label>
              <button
                disabled={busy || !newGroupName.trim()}
                className="admin-btn-primary mt-3 w-full"
              >
                Create group
              </button>
            </form>
          ) : null}
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
            <label className="block">
              <span className="sr-only">Search clients</span>
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                  setSelected(new Set());
                }}
                placeholder="Search all clients by name, email, or phone"
                className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[var(--helios-orange)]/50"
              />
            </label>
            <select
              value={groupFilter}
              onChange={(event) => {
                setGroupFilter(event.target.value);
                setPage(1);
                setSelected(new Set());
              }}
              className="rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white outline-none"
            >
              <option value="all">All clients</option>
              <option value="ungrouped">Ungrouped</option>
              {initialGroups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>

          {canManage && selected.size ? (
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.04] p-4 sm:flex-row sm:items-center">
              <p className="text-sm text-white/65">{selected.size} selected</p>
              <select
                value={selectedGroupId}
                onChange={(event) => setSelectedGroupId(event.target.value)}
                className="min-w-48 rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white sm:ml-auto"
              >
                <option value="">Choose a group</option>
                {initialGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !selectedGroupId}
                onClick={() => updateMembership("add")}
                className="admin-btn-primary"
              >
                Add to group
              </button>
              <button
                type="button"
                disabled={busy || !selectedGroupId}
                onClick={() => updateMembership("remove")}
                className="admin-btn-secondary"
              >
                Remove
              </button>
            </div>
          ) : null}

          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <div className={`hidden gap-5 border-b border-white/[0.08] px-6 py-4 text-[0.62rem] uppercase tracking-[0.16em] text-white/30 md:grid ${canManage ? "grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.2fr)_minmax(10rem,0.7fr)]" : "grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(10rem,0.7fr)]"}`}>
              {canManage ? (
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleVisible}
                  aria-label="Select all clients on this page"
                  className="h-4 w-4 accent-[var(--helios-orange)]"
                />
              ) : null}
              <span>Name</span><span>Email</span><span>Phone</span>
            </div>
            {visibleClients.length ? (
              <div className="divide-y divide-white/[0.07]">
                {visibleClients.map((client) => (
                  <article
                    key={client.id}
                    className={`grid gap-3 px-6 py-5 md:items-center md:gap-5 ${canManage ? "md:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.2fr)_minmax(10rem,0.7fr)]" : "md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(10rem,0.7fr)]"}`}
                  >
                    {canManage ? (
                      <input
                        type="checkbox"
                        checked={selected.has(client.id)}
                        onChange={() => toggleClient(client.id)}
                        aria-label={`Select ${client.displayName}`}
                        className="h-4 w-4 accent-[var(--helios-orange)]"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white/75">{client.displayName}</p>
                      {client.groupIds.length ? (
                        <p className="mt-1 truncate text-[0.68rem] text-white/25">
                          {client.groupIds
                            .map((id) => initialGroups.find((group) => group.id === id)?.name)
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <a href={`mailto:${client.email}`} className="truncate text-sm text-white/45 transition hover:text-white">{client.email}</a>
                    <p className="text-sm text-white/45">{client.phone || "—"}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="px-6 py-12 text-center text-sm text-white/35">
                {query || groupFilter !== "all"
                  ? "No clients match those filters."
                  : "No clients yet. Run the first HDPhotoHub sync."}
              </p>
            )}

            {clients.length ? (
              <footer className="flex flex-col gap-3 border-t border-white/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-white/30">
                  Showing {start}–{end} of {clients.length}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="admin-btn-secondary"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-white/35">Page {currentPage} of {pageCount}</span>
                  <button
                    type="button"
                    disabled={currentPage === pageCount}
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                    className="admin-btn-secondary"
                  >
                    Next
                  </button>
                </div>
              </footer>
            ) : null}
          </section>
        </div>
      </section>

      {editingGroup ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-group-title">
          <form onSubmit={renameGroup} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141414] p-6">
            <p className="eyebrow text-[var(--helios-orange)]">Client group</p>
            <h2 id="edit-group-title" className="mt-3 text-2xl font-light text-white">Edit group</h2>
            <label className="mt-5 block text-xs text-white/40">
              Group name
              <input
                autoFocus
                required
                maxLength={80}
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white"
              />
            </label>
            <div className="mt-6 flex flex-wrap justify-between gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => deleteGroup(editingGroup)}
                className="admin-btn-destructive"
              >
                Delete group
              </button>
              <div className="flex gap-3">
                <button type="button" disabled={busy} onClick={() => setEditingGroup(null)} className="admin-btn-secondary">Cancel</button>
                <button disabled={busy || !editingName.trim()} className="admin-btn-primary">{busy ? "Saving…" : "Save group"}</button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
