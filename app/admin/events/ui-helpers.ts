export function localDateTime(value: string | null, timeZone: string): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
}

export function displayDate(value: string | null, timeZone: string): string {
  return value ? new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Date not set";
}

export function responseCounts(invitations: { response: string }[] = []) {
  return { total: invitations.length, yes: invitations.filter(i => i.response === "YES").length, no: invitations.filter(i => i.response === "NO").length, pending: invitations.filter(i => i.response === "PENDING").length };
}
