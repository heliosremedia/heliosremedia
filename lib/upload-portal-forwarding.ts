const PORTAL_ORIGIN = "https://www.heliosrealestatemedia.com";
const BASE = "/admin/production-console";
export function portalTarget(asset: string, requestUrl: string) {
  const target = new URL("https://helios-upload-portal.vercel.app/api/portal");
  target.searchParams.set("asset", asset);
  if (asset === "dropbox/callback") {
    const incoming = new URL(requestUrl);
    for (const name of ["code", "state", "error"]) {
      const values = incoming.searchParams.getAll(name);
      if (values.length > 1 || (values[0]?.length || 0) > 4096) throw new Error("Invalid callback");
      if (values.length) target.searchParams.set(name, values[0]);
    }
  }
  return target;
}
export function portalRedirect(asset: string, location: string) {
  const url = new URL(location, PORTAL_ORIGIN);
  if (url.username || url.password || url.hash) throw new Error("Invalid redirect");
  if (asset === "dropbox/start" && url.origin === "https://www.dropbox.com" && url.pathname === "/oauth2/authorize"
      && url.searchParams.get("redirect_uri") === PORTAL_ORIGIN + BASE + "/dropbox/callback") return url.toString();
  if (asset === "dropbox/callback" && url.origin === PORTAL_ORIGIN
      && url.pathname === BASE + "/settings/dropbox" && !url.search) return url.toString();
  throw new Error("Invalid redirect");
}
export function allowedPortalPost(asset: string, origin: string | null) {
  return asset === "dropbox/start" && origin === PORTAL_ORIGIN;
}
