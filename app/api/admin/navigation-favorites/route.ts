import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const allowedDestinations = new Set([
  "/admin/about",
  "/admin/activity",
  "/admin/blog",
  "/admin/client-portals",
  "/admin/clients",
  "/admin/ctas",
  "/admin/email-studio",
  "/admin/faqs",
  "/admin/homepage",
  "/admin/inquiries",
  "/admin/locations",
  "/admin/media",
  "/admin/projects",
  "/admin/services",
  "/admin/settings",
  "/admin/testimonials",
  "/admin/trusted-logos",
  "/admin/users",
]);

export async function PATCH(request: Request) {
  const session = await getAdminSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as { favorites?: unknown };
    const favorites = Array.isArray(body.favorites) ? body.favorites : null;

    if (
      !favorites ||
      favorites.length > allowedDestinations.size ||
      !favorites.every(
        (value): value is string =>
          typeof value === "string" && allowedDestinations.has(value),
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Choose valid navigation favorites." },
        { status: 400 },
      );
    }

    const uniqueFavorites = [...new Set(favorites)];

    await prisma.adminUser.update({
      where: { id: session.userId },
      data: { navigationFavorites: uniqueFavorites },
    });

    return NextResponse.json({ success: true, favorites: uniqueFavorites });
  } catch (error) {
    console.error("Unable to save navigation favorites:", error);
    return NextResponse.json(
      { success: false, error: "Navigation favorites could not be saved." },
      { status: 500 },
    );
  }
}
