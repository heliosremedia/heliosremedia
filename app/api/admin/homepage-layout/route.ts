import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/session";
import {
  normalizeHomepageCurationPreferences,
} from "@/lib/homepage-curation-layout";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  try {
    const preferences = normalizeHomepageCurationPreferences(
      await request.json(),
    );
    await prisma.adminUser.updateMany({
      where: { id: session.userId, workspaceId: session.workspaceId },
      data: { homepageCurationPreferences: preferences },
    });
    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    console.error("Unable to save homepage curation layout:", error);
    return NextResponse.json(
      { success: false, error: "Homepage layout could not be saved." },
      { status: 500 },
    );
  }
}
