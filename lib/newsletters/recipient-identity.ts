/** Bind delivery eligibility to the client record as well as its address. */
export function newsletterRecipientIdentity(clientId: string | null, email: string) {
  if (!clientId) return null;
  return JSON.stringify([clientId, email.trim().toLowerCase()]);
}
