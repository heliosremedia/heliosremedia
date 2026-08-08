export type SocialGroundingReview = {
  grounded: boolean;
  unsupportedClaims: string[];
};

export function normalizeSocialGroundingReview(value: unknown): SocialGroundingReview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.grounded !== "boolean" || !Array.isArray(row.unsupportedClaims)) return null;
  const unsupportedClaims = row.unsupportedClaims
    .filter((claim): claim is string => typeof claim === "string")
    .map((claim) => claim.trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, 20);
  if (unsupportedClaims.length) return { grounded: false, unsupportedClaims };
  if (!row.grounded) {
    return {
      grounded: false,
      unsupportedClaims: ["The verifier flagged unsupported content without identifying a specific claim."],
    };
  }
  return { grounded: true, unsupportedClaims: [] };
}

export function socialDraftText(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const text: string[] = [];
  const visit = (item: unknown) => {
    if (typeof item === "string") text.push(item.trim());
    else if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === "object") Object.values(item as Record<string, unknown>).forEach(visit);
  };
  visit(value);
  return text.filter(Boolean).join("\n").slice(0, 40_000);
}
