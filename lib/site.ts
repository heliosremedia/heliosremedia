const LOCAL_SITE_URL = "http://localhost:3000";
export const DEFAULT_PUBLIC_SITE_URL = "https://www.heliosrealestatemedia.com";

export function normalizeSiteUrl(value: string) {
  const url = value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`;

  return new URL(url).origin;
}

export function getConfiguredSiteUrl(websiteUrl?: string | null) {
  const configured = websiteUrl?.trim();
  if (!configured) return getSiteUrl();
  try {
    const normalized = normalizeSiteUrl(configured);
    return normalized.startsWith("https://") ? normalized : getSiteUrl();
  } catch {
    return getSiteUrl();
  }
}

export function getConfiguredAbsoluteUrl(path: string, websiteUrl?: string | null) {
  return new URL(path.replace(/^\/+/, ""), `${getConfiguredSiteUrl(websiteUrl)}/`).toString();
}

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredUrl) {
    return normalizeSiteUrl(configuredUrl);
  }

  const vercelUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  return vercelUrl ? normalizeSiteUrl(vercelUrl) : LOCAL_SITE_URL;
}

export function getCanonicalSiteUrl(websiteUrl?: string | null) {
  return getConfiguredSiteUrl(websiteUrl || DEFAULT_PUBLIC_SITE_URL);
}

export function getCanonicalAbsoluteUrl(path: string, websiteUrl?: string | null) {
  return new URL(path.replace(/^\/+/, ""), `${getCanonicalSiteUrl(websiteUrl)}/`).toString();
}

export function isProductionIndexable() {
  return process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : process.env.NODE_ENV === "production";
}

export function getVerifiedSocialProfiles(values: Array<string | null | undefined>) {
  return values.flatMap((value) => {
    if (!value) return [];
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) return [];
      if (/^(www\.)?facebook\.com$/i.test(url.hostname) && /^\/(search|public)(\/|$)/i.test(url.pathname)) return [];
      return [url.toString()];
    } catch {
      return [];
    }
  });
}

export function getAbsoluteUrl(path = "/") {
  return new URL(path, `${getSiteUrl()}/`).toString();
}
