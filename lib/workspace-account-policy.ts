import type { AdminRole } from "@/app/generated/prisma/client";

type AccountMutation = {
  role: AdminRole | null;
  active: boolean | null;
};

export function getProtectedOwnerMutationError(
  targetRole: AdminRole,
  mutation: AccountMutation,
) {
  if (targetRole !== "OWNER") return null;
  if (mutation.active === false) {
    return "The workspace owner cannot be deactivated.";
  }
  if (mutation.role && mutation.role !== "OWNER") {
    return "Use the ownership transfer workflow before changing the workspace owner's role.";
  }
  return null;
}

export function getAccountIdentity(
  displayName: string,
  title: string | null,
) {
  return {
    displayName: displayName.trim() || "Name not provided",
    professionalTitle: title?.trim() || "Not provided",
  };
}
