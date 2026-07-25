import QRCode from "qrcode";
import { getPublicReferralCampaign } from "@/lib/referrals/public";
import { getSiteUrl } from "@/lib/site";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const referral = await getPublicReferralCampaign(token);
  if (!referral || referral.expired) return new Response("Referral unavailable", { status: 404 });
  const url = `${getSiteUrl()}/refer/${encodeURIComponent(token)}`;
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    color: { dark: "#11110f", light: "#f8f5ef" },
  });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="helios-referral-${referral.link.code}.svg"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
