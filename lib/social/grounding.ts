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

const HIGH_RISK_PROPERTY_TERMS = [
  "luxury", "rare", "one-acre", "one acre", "acreage", "homesite", "resort-inspired",
  "resort inspired", "refined interior", "custom-built", "custom built", "waterfront",
  "mountain view", "renovated", "award-winning", "award winning",
];

function normalizedFactCorpus(facts: Record<string, unknown>) {
  return Object.values(facts)
    .filter((value): value is string | number | boolean => ["string", "number", "boolean"].includes(typeof value))
    .map(String)
    .join(" ")
    .toLowerCase();
}

export function deterministicallyGroundSocialDrafts<T>(value: T, facts: Record<string, unknown>) {
  const corpus = normalizedFactCorpus(facts);
  const removedClaims: string[] = [];
  const unsupportedTerm = (text: string) => HIGH_RISK_PROPERTY_TERMS.find((term) => text.toLowerCase().includes(term) && !corpus.includes(term));
  const unsupportedNamedLocation = (text: string) => {
    for (const match of text.matchAll(/\b(?:at|in)\s+([A-Z][A-Za-z-]+(?:\s+[A-Z][A-Za-z-]+){0,2})/g)) {
      if (!corpus.includes(match[1].toLowerCase())) return match[1];
    }
    return "";
  };
  const containsInternalIdentifier = (text: string) => /\bcm[a-z0-9]{15,}\b/i.test(text);
  const visit = (item: unknown): unknown => {
    if (typeof item === "string") {
      const parts = item.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean);
      const kept = parts.filter((part) => {
        const unsupported = unsupportedTerm(part) || unsupportedNamedLocation(part) || (containsInternalIdentifier(part) ? "internal identifier" : "");
        if (!unsupported) return true;
        removedClaims.push(part.slice(0, 500));
        return false;
      });
      return kept.join("\n\n");
    }
    if (Array.isArray(item)) return item.map(visit).filter((entry) => entry !== "");
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item as Record<string, unknown>).map(([key, entry]) => [key, visit(entry)]));
    }
    return item;
  };
  return { value: visit(value) as T, removedClaims: [...new Set(removedClaims)].slice(0, 30) };
}
