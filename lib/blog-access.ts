import "server-only";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/** Temporary containment until BlogPost/BlogSeries have verified ownership. */
export async function requireLegacyBlogAccess() {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) {
    return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
  }
  // Never use branding settings or a oldest-workspace fallback as ownership proof.
  // Do not expose global Blog data to any company once multiple workspaces exist.
  const workspaces = await prisma.workspace.findMany({ take: 2, select: { id: true } });
  if (workspaces.length !== 1 || workspaces[0].id !== session.workspaceId) {
    return NextResponse.json({ success: false, error: "Blog workspace ownership must be configured before this action is available." }, { status: 409 });
  }
  return null;
}
