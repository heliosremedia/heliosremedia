/** Pure import policy. Never copy private notes, client contacts, or source status into Studio. */
export type HdphRecord = Record<string, unknown>;
export function hdphRecord(value: unknown): HdphRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as HdphRecord : {};
}
export function hdphId(value: unknown): number {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error("Enter a valid HDPhotoHub site or media ID.");
  return Number(value);
}
const text = (value: unknown, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : "";
export function hdphProperty(site: HdphRecord) {
  const location = hdphRecord(site.location);
  const address = text(location.address);
  if (!address) throw new Error("This HDPhotoHub property has no street address to import.");
  return { title: address.slice(0, 120), propertyAddress: [address, text(location.address2), text(location.city), text(location.region), text(location.postalCode)].filter(Boolean).join(", ").slice(0, 300), city: text(location.city, 120), state: text(location.region, 120), locationLabel: [text(location.city, 120), text(location.region, 120)].filter(Boolean).join(", ").slice(0, 180) };
}
export function hdphEligiblePhoto(media: HdphRecord): boolean {
  return media.type === "photo" && media.status === "visible" && !media.archived && media.canDownload !== false && media.branded !== false;
}
export function hdphPhotoUrl(media: HdphRecord): string {
  if (!hdphEligiblePhoto(media)) throw new Error("This photo is hidden, restricted, archived, or unavailable for import.");
  // Prefer a rendered photo, not a RAW original. Validate/re-encode bytes before storage.
  const images = (Array.isArray(media.images) ? media.images : []).map(hdphRecord)
    .filter(image => typeof image.url === "string" && Number(image.width) > 0)
    .sort((a,b) => Number(b.width) - Number(a.width));
  const selected = images.find(image => Number(image.width) <= 4096) || images.at(-1);
  if (!selected) throw new Error("This photo has no ready image rendition. Try again after HDPhotoHub finishes processing.");
  return String(selected.url);
}
export function hdphSafeImageUrl(value: string, extraHosts = ""): string {
  const url = new URL(value);
  const allowed = ["hd.pics", "hdphotohub.com", ...extraHosts.split(",").map(v => v.trim().toLowerCase()).filter(Boolean)];
  if (url.protocol !== "https:" || url.username || url.password || url.port || !allowed.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throw new Error("This photo host is not approved for import. Use manual upload or ask an administrator to verify the HDPhotoHub image host.");
  }
  return url.href;
}

/** Validate the provider envelope instead of misreporting a protocol mismatch as no properties. */
export function hdphSearchPage(value: unknown, brandId: number, offset: number) {
  const page = hdphRecord(value);
  if (!Array.isArray(page.data)) throw new Error("HDPhotoHub returned an unexpected search response. No matching result can be confirmed; please retry or contact an administrator.");
  const rows = page.data.map(hdphRecord);
  const sameBrand = rows.filter(site => Number(site.brandId) === brandId);
  const delivered = sameBrand.filter(site => Boolean(site.bought));
  const active = delivered.filter(site => ["active", "inactive", "complete"].includes(String(site.status)));
  const addressed = active.filter(site => typeof hdphRecord(site.location).address === "string" && String(hdphRecord(site.location).address).trim());
  const next = page.nextPage == null ? null : Number(page.nextPage);
  if (next != null && (!Number.isSafeInteger(next) || next <= offset || next > 10000000)) throw new Error("HDPhotoHub returned an invalid search continuation. Please narrow the property address.");
  return {
    sites: addressed.map(site => ({ siteId: hdphId(site.siteId), ...hdphProperty(site) })),
    nextOffset: next,
    diagnostics: { returned: rows.length, sameBrand: sameBrand.length, delivered: delivered.length, active: active.length, addressed: addressed.length },
  };
}


/** Discovery includes payment-protected sites; selection/import separately enforce access. */
export function hdphSearchPath(term: string, offset: number) {
  const params = new URLSearchParams({ address: term, quantity: "25", offset: String(offset), sort: "created desc" });
  params.append("deliveryLevel", "basic");
  params.append("deliveryLevel", "full");
  return `/sites/search?${params.toString()}`;
}

export function hdphThumbnailUrl(media: HdphRecord): string {
  if (!hdphEligiblePhoto(media)) throw new Error("This photo is unavailable for preview.");
  const images = (Array.isArray(media.images) ? media.images : []).map(hdphRecord)
    .filter(image => typeof image.url === "string" && Number(image.width) > 0)
    .sort((a,b) => Number(a.width) - Number(b.width));
  const selected = images.find(image => Number(image.width) >= 400) || images.at(-1);
  if (!selected) throw new Error("This photo has no ready preview.");
  return String(selected.url);
}
