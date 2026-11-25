import { validPhotoVaEmail, validPhotoVaId } from "./studio-photo-va-recipients.ts";

type StudioActor = { role: string; workspaceId: string; userId: string };
export function canManagePhotoVaContacts(actor: StudioActor | null, targetWorkspace: string | undefined) {
  return Boolean(actor && actor.role === "OWNER" && validPhotoVaId(actor.workspaceId) && validPhotoVaId(actor.userId) &&
    (targetWorkspace === undefined || (validPhotoVaId(targetWorkspace) && actor.workspaceId === targetWorkspace)));
}

export function readPhotoVaContactForm(data: FormData) {
  const teamMemberId = data.get("teamMemberId"), intent = data.get("intent");
  if (!validPhotoVaId(teamMemberId) || !["enable", "disable"].includes(String(intent))) return null;
  if (intent === "disable") return { teamMemberId, enabled: false as const };
  const input = data.get("email");
  const email = typeof input === "string" ? input.trim().toLowerCase() : "";
  return validPhotoVaEmail(email) ? { teamMemberId, enabled: true as const, email } : null;
}
