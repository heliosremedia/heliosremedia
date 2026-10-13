import { NextResponse } from "next/server";
import { SupportDenied, SupportInvalid } from "./access";
export function supportResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
export function supportFailure(error: unknown) {
  const status = error instanceof SupportInvalid || error instanceof SyntaxError ? 400 : error instanceof SupportDenied || (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") ? 403 : 503;
  return supportResponse({ success: false, error: status === 400 ? "Invalid support request." : status === 403 ? "Support access is unavailable." : "Support request could not be completed." }, status);
}
