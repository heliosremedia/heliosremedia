import { getReferralAdminSession } from "@/lib/referrals/access";
import { prisma } from "@/lib/prisma";

function cell(value: unknown) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const session = await getReferralAdminSession();
  if (!session) return new Response("Administrator access is required.", { status: 403 });
  const campaignId = new URL(request.url).searchParams.get("campaignId");
  const referrals = await prisma.referralSubmission.findMany({
    where: campaignId ? { campaignId } : {},
    include: {
      campaign: { select: { internalName: true, publicTitle: true } },
      advocate: { include: { client: { select: { displayName: true, email: true } } } },
      rewards: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });
  const header = ["Referral ID", "Campaign", "Referred Name", "Email", "Phone", "Advocate", "Status", "Attribution", "Submitted", "Reward Status", "External Order"];
  const rows = referrals.map(item => [
    item.id, item.campaign.internalName, `${item.firstName} ${item.lastName}`, item.email, item.phone,
    item.advocate?.client.displayName, item.status, item.attributionStatus, item.createdAt,
    item.rewards[0]?.status, item.externalOrderId,
  ]);
  const csv = [header, ...rows].map(row => row.map(cell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="helios-referrals-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
