import "server-only";

export function referralStudioEnabled() {
  return process.env.REFERRAL_STUDIO_ENABLED?.trim().toLowerCase() !== "false";
}

export function requireReferralStudioEnabled() {
  if (!referralStudioEnabled()) {
    throw new Error("REFERRAL_STUDIO_DISABLED");
  }
}
