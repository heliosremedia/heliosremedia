import { NextResponse } from "next/server";
export function eventError(error: unknown) {
  const message = error instanceof Error ? error.message : "Event request failed.";
  const status = message === "Administrator access required." ? 403 : message === "Event not found." ? 404 : 400;
  // Never echo provider/database diagnostics or token-bearing data.
  return NextResponse.json({success:false,error:message.startsWith("\n") || message.includes("prisma") ? "Event request failed. Please try again." : message},{status,headers:{"Cache-Control":"no-store"}});
}
