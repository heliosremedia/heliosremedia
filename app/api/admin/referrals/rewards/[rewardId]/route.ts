import { NextResponse } from "next/server";
import type { ReferralRewardStatus, ReferralRewardType } from "@/app/generated/prisma/client";
import { getReferralAdminSession } from "@/lib/referrals/access";
import { updateReward } from "@/lib/referrals/studio";
import { text } from "@/lib/referrals/validation";

const statuses = new Set<ReferralRewardStatus>(["NOT_ELIGIBLE", "PENDING_REVIEW", "ELIGIBLE", "APPROVED", "ISSUED", "DECLINED", "REVERSED"]);
const types = new Set<ReferralRewardType>(["ACCOUNT_CREDIT", "PERCENTAGE_DISCOUNT", "FIXED_VALUE_GIFT", "COMPLIMENTARY_SERVICE", "CUSTOM", "NONE"]);

export async function POST(request: Request, context: { params: Promise<{ rewardId: string }> }) {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  try {
    const { rewardId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const status = typeof body.status === "string" && statuses.has(body.status as ReferralRewardStatus) ? body.status as ReferralRewardStatus : null;
    const type = typeof body.type === "string" && types.has(body.type as ReferralRewardType) ? body.type as ReferralRewardType : undefined;
    if (!status) return NextResponse.json({ success: false, error: "Choose a valid reward status." }, { status: 400 });
    await updateReward(rewardId, status, {
      type, value: text(body.value, 500), notes: text(body.notes, 2_000), externalReference: text(body.externalReference, 500),
    }, { userId: session.userId, email: session.email });
    return NextResponse.json({ success: true, message: `Reward moved to ${status.replaceAll("_", " ").toLowerCase()}.` });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "The reward could not be updated." }, { status: 400 });
  }
}
