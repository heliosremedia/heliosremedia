import "server-only";
import { hdphEligiblePhoto, hdphId, hdphProperty, hdphRecord, hdphSearchPage, hdphSearchPath } from "./project-hdph-import";

export function projectHdphReader(workspaceId: string) {
  const token = process.env.HDPH_V3_TOKEN?.trim();
  const boundWorkspace = process.env.HDPH_PROJECTS_WORKSPACE_ID || process.env.HDPH_SUMMARY_WORKSPACE_ID;
  const brand = process.env.HDPH_PROJECTS_BRAND_ID || process.env.HDPH_SUMMARY_BRAND_ID;
  if (!token || !brand || boundWorkspace !== workspaceId) throw new Error("HDPhotoHub Projects import is not connected for this workspace. Manual project creation remains available.");
  const brandId = hdphId(brand);
  async function read(path: string) {
    const response = await fetch(`https://api.hd.pics${path}`, { headers: { "hd-token": token!, Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HDPhotoHub read failed (${response.status}). Check connection and record access; nothing in HDPhotoHub was changed.`);
    return hdphRecord(await response.json());
  }
  return {
    async search(query: string, offset = 0) {
      const term = query.trim();
      if (term.length < 3 || term.length > 200) throw new Error("Enter at least three characters of the property address.");
      const page = await read(hdphSearchPath(term, offset));
      const result = hdphSearchPage(page, brandId, offset);
      // Counts only: never log credentials, addresses, IDs, client records or media URLs.
      console.info("hdph-project-search", result.diagnostics);
      if (result.diagnostics.returned > 0 && result.diagnostics.sameBrand === 0) throw new Error("HDPhotoHub returned properties outside this workspace's configured brand. An administrator needs to check the import connection.");
      return { sites: result.sites, nextOffset: result.nextOffset };
    },
    async site(id: number) {
      const site = hdphRecord((await read(`/sites/${hdphId(id)}?expand=media`)).data);
      if (Number(site.siteId) !== id || Number(site.brandId) !== brandId) throw new Error("The property does not match this workspace's HDPhotoHub brand.");
      // site-mustpay configures client payment behavior, not this API caller's access.
      // The authenticated media endpoint and per-item download restrictions govern retrieval.
      if (!site.bought || !["active", "inactive", "complete"].includes(String(site.status))) throw new Error("Only delivered, non-archived properties can be imported. Use manual creation for other work.");
      if (!Array.isArray(site.media)) throw new Error("HDPhotoHub did not return its media inventory.");
      return { siteId: id, ...hdphProperty(site), photos: site.media.map(hdphRecord).filter(hdphEligiblePhoto).map(m => ({ mediaId: hdphId(m.mediaId), name: typeof m.name === "string" ? m.name.slice(0,300) : `Photo ${m.mediaId}` })) };
    },
    async photo(siteId: number, mediaId: number) {
      const site = await this.site(siteId);
      if (!site.photos.some(photo => photo.mediaId === mediaId)) throw new Error("This photo is no longer available for import.");
      const media = hdphRecord((await read(`/media/${hdphId(mediaId)}`)).data);
      if (Number(media.siteId) !== siteId || Number(media.brandId) !== brandId || Number(media.mediaId) !== mediaId) throw new Error("This photo does not belong to the selected property and brand.");
      return media;
    },
  };
}
