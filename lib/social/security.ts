import "server-only";
import { createHash } from "node:crypto";
export { encryptSocialToken, decryptSocialToken, createOAuthState, verifyOAuthState } from "./token-crypto";

export function contentDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
