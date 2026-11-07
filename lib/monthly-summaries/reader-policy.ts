type Environment = { [key: string]: string | undefined; HDPH_API_KEY?: string; HDPH_V3_TOKEN?: string };

// Once V3 is selected, configuration or API failures must not silently scan all clients.
export function useLegacySummaryReader(env: Environment) {
  return !env.HDPH_V3_TOKEN?.trim() && Boolean(env.HDPH_API_KEY?.trim());
}

export function summaryClientScope(useV1: boolean, onlyClientId?: string, afterClientId?: string) {
  if (!useV1) return {};
  return onlyClientId ? { id: onlyClientId } : afterClientId ? { id: { gt: afterClientId } } : {};
}
