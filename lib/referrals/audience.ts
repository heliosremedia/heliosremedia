export type AudienceClient = {
  id: string;
  normalizedEmail: string;
  emailSubscribed: boolean;
  archivedAt: Date | null;
  emailStatus: string;
  suppressed?: boolean;
};

export type AudienceSelection = {
  mode: "INDIVIDUALS" | "GROUPS" | "FILTERED" | "ALL_ELIGIBLE";
  selectedClientIds: string[];
  selectedGroupClientIds: string[];
  excludedClientIds: string[];
};

export function clientExclusionReasons(client: AudienceClient) {
  const reasons: string[] = [];
  if (!client.normalizedEmail) reasons.push("Missing email");
  if (!client.emailSubscribed) reasons.push("Unsubscribed");
  if (client.archivedAt) reasons.push("Archived");
  if (client.emailStatus !== "VALID") reasons.push(`Email ${client.emailStatus.toLowerCase()}`);
  if (client.suppressed) reasons.push("Suppressed");
  return reasons;
}

export function resolveAudience(clients: AudienceClient[], selection: AudienceSelection) {
  if (selection.mode !== "ALL_ELIGIBLE" && selection.mode !== "FILTERED"
    && !selection.selectedClientIds.length
    && !selection.selectedGroupClientIds.length) {
    throw new Error("Choose a specific audience or explicitly select All eligible clients.");
  }
  const selected = selection.mode === "ALL_ELIGIBLE" || selection.mode === "FILTERED"
    ? new Set(clients.map(client => client.id))
    : new Set([...selection.selectedClientIds, ...selection.selectedGroupClientIds]);
  for (const id of selection.excludedClientIds) selected.delete(id);

  const eligible: AudienceClient[] = [];
  const excluded: Array<{ client: AudienceClient; reasons: string[] }> = [];
  for (const client of clients) {
    if (!selected.has(client.id)) continue;
    const reasons = clientExclusionReasons(client);
    if (reasons.length) excluded.push({ client, reasons });
    else eligible.push(client);
  }
  const unique = [...new Map(eligible.map(client => [client.normalizedEmail, client])).values()];
  return { eligible: unique, excluded };
}
