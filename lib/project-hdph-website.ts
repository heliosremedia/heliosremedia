import { hdphId, type HdphRecord } from "./project-hdph-import";

/** Jake supplied this branded public viewer URL. Never reuse it for other brands. */
export function hdphPropertyWebsite(site: HdphRecord, now = Date.now()): string | null {
  if (Number(site.brandId) !== 7708 || site.status !== "active" || site.hasMarketingKit !== true) return null;
  const keys = Array.isArray(site.keyring) ? site.keyring : [];
  if (keys.includes("site-disablepropertysite")) return null;
  if (site.expiration != null) {
    const expires = Date.parse(String(site.expiration));
    if (!Number.isFinite(expires) || expires <= now) return null;
  }
  let siteId: number;
  try { siteId = hdphId(site.siteId); } catch { return null; }
  return `https://heliosrealestatemedia.hd.pics/view/?s=${siteId}&nohit=1`;
}
