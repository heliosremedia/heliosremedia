const ASSET_EXTENSIONS = /\.(?:avif|bmp|css|eot|gif|ico|jpe?g|js|m3u8|mov|mp4|m4v|ogg|otf|pdf|png|svg|tiff?|ts|ttf|webm|webp|woff2?)(?:$|[?#])/i;
const ASSET_HOSTS = /(?:^|\.)(?:cloudflarestorage\.com|cloudflarestream\.com|r2\.dev|videodelivery\.net)$/i;
const HELIOS_HOSTS = /(?:^|\.)heliosrealestatemedia\.com$/i;

export function parseReportableOutboundUrl(value: string | null | undefined, publicOrigin?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const publicHost = publicOrigin ? new URL(publicOrigin).hostname.toLowerCase().replace(/^www\./, "") : null;
    if (HELIOS_HOSTS.test(host) || (publicHost && host === publicHost)) return null;
    if (ASSET_HOSTS.test(host) || ASSET_EXTENSIONS.test(`${url.pathname}${url.search}${url.hash}`)) return null;
    if (/(?:^|\.)(?:cdn|assets?|media|storage|static)\./i.test(host)) return null;
    return url;
  } catch {
    return null;
  }
}

export function normalizedOutboundKey(value: string) {
  const url = parseReportableOutboundUrl(value);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !/^utm_/i.test(key))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(params).toString();
  return `${host}${path.toLowerCase()}${query ? `?${query}` : ""}`;
}

export function outboundDestinationLabel(value: string) {
  const url = parseReportableOutboundUrl(value);
  if (!url) return "External destination";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (/(^|\.)facebook\.com$/.test(host)) return "Facebook";
  if (/(^|\.)linkedin\.com$/.test(host)) return "LinkedIn";
  if (/(^|\.)instagram\.com$/.test(host)) return "Instagram";
  if (/(^|\.)(?:x\.com|twitter\.com)$/.test(host)) return "X";
  if (/book|schedule|appointment|hdphotohub/.test(host)) return "Booking Provider";
  return "Client Website";
}
