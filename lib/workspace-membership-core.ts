export type MembershipRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
export type Membership = {
  userId: string;
  workspaceId: string;
  role: MembershipRole;
  status: string;
};

// The compatibility workspace comes from the database, never a request parameter.
export async function resolveMembershipAccess(
  user: { id: string; active: boolean; workspaceId: string; role: MembershipRole },
  enabled: boolean,
  lookup: (userId: string, workspaceId: string) => Promise<Membership | null>,
) {
  if (!user.active) return null;
  if (!enabled) return { workspaceId: user.workspaceId, role: user.role };
  const membership = await lookup(user.id, user.workspaceId);
  if (!membership || membership.userId !== user.id || membership.workspaceId !== user.workspaceId || membership.status !== "ACTIVE") return null;
  return { workspaceId: membership.workspaceId, role: membership.role };
}
