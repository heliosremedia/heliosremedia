export function isReferralAdministrator(role: string | null | undefined) {
  return role === "OWNER" || role === "ADMIN";
}
