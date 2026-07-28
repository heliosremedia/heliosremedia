import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { recordAuditEvent } from "@/lib/audit";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function optionalText(value: unknown, max: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > max) throw new Error("INVALID_INPUT");
  return text || null;
}

function normalizedPhone(value: unknown) {
  const phone = optionalText(value, 40);
  if (!phone) return null;
  const normalized = phone.replace(/[^\d+]/g, "");
  if (!/^\+?\d{7,15}$/.test(normalized)) throw new Error("INVALID_PHONE");
  return normalized.startsWith("+") ? normalized : `+${normalized}`;
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication is required." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const current = await prisma.adminUser.findUnique({ where: { id: session.userId } });
    if (!current) return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });

    const firstName = optionalText(body.firstName, 80);
    const lastName = optionalText(body.lastName, 80);
    const displayName = optionalText(body.displayName, 120);
    const title = optionalText(body.title, 120);
    if (!displayName) throw new Error("INVALID_INPUT");
    const email = String(body.email || "").trim().toLowerCase();
    if (!emailPattern.test(email) || email.length > 320) throw new Error("INVALID_EMAIL");
    const phone = normalizedPhone(body.phone);
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const emailChanged = email !== current.email;
    const passwordChanged = Boolean(newPassword);

    if ((emailChanged || passwordChanged) && (!current.passwordHash || !(await verifyPassword(currentPassword, current.passwordHash)))) {
      return NextResponse.json({ success: false, error: "Enter your current password to confirm this security-sensitive change." }, { status: 403 });
    }
    if (passwordChanged && (newPassword.length < 12 || newPassword.length > 128 || !/[a-z]/i.test(newPassword) || !/\d/.test(newPassword))) {
      return NextResponse.json({ success: false, error: "Use 12–128 characters with at least one letter and number." }, { status: 400 });
    }
    if (emailChanged && await prisma.adminUser.findFirst({ where: { email, id: { not: current.id } }, select: { id: true } })) {
      return NextResponse.json({ success: false, error: "Another account already uses that email." }, { status: 409 });
    }
    const notificationPreferences = body.notificationPreferences && typeof body.notificationPreferences === "object"
      ? body.notificationPreferences as Record<string, boolean>
      : {};
    const updated = await prisma.adminUser.update({
      where: { id: current.id },
      data: {
        firstName, lastName, displayName, title, email, phone, notificationPreferences,
        ...(passwordChanged ? { passwordHash: await hashPassword(newPassword), sessionVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null } : {}),
        ...(emailChanged ? { sessionVersion: { increment: 1 } } : {}),
      },
      select: { id: true, firstName: true, lastName: true, displayName: true, title: true, email: true, phone: true, notificationPreferences: true },
    });
    if (emailChanged || passwordChanged) {
      await recordAuditEvent({
        actorId: current.id, actorEmail: current.email,
        action: emailChanged ? "PROFILE_EMAIL_CHANGED" : "PROFILE_PASSWORD_CHANGED",
        entityType: "AdminUser", entityId: current.id,
        summary: emailChanged ? "Administrator verified and changed their account email." : "Administrator changed their password and revoked existing sessions.",
      });
    }
    revalidatePath("/admin/users");
    return NextResponse.json({ success: true, user: updated, signedOut: emailChanged || passwordChanged });
  } catch (error) {
    const messages: Record<string, string> = {
      INVALID_INPUT: "Complete the required fields and stay within the displayed limits.",
      INVALID_EMAIL: "Enter a valid email address.",
      INVALID_PHONE: "Enter a valid telephone number including country code.",
    };
    if (error instanceof Error && messages[error.message]) return NextResponse.json({ success: false, error: messages[error.message] }, { status: 400 });
    console.error("Unable to update administrator profile:", error);
    return NextResponse.json({ success: false, error: "Your profile could not be updated." }, { status: 500 });
  }
}
