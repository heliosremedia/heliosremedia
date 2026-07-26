import { createHash } from "node:crypto";

export const MARKETING_TOKEN_TTL_DAYS = 365;

export function hashPreferenceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function marketingStatusAllowsSend(status: string | null | undefined) {
  return status !== "UNSUBSCRIBED" && status !== "SUPPRESSED";
}

export function validPreferenceTokenFormat(token: string) {
  return /^[A-Za-z0-9_-]{40,80}$/.test(token);
}

export function oneClickUnsubscribeHeaders(url: string) {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
