"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { MAX_PHOTO_VA_RECIPIENTS } from "@/lib/studio-photo-va-recipients";
import { canManagePhotoVaContacts, readPhotoVaContactForm } from "@/lib/studio-photo-va-settings";

const path = "/admin/photo-va-contacts";
const status = (value: string): never => redirect(path + "?status=" + value);

export async function savePhotoVaContact(formData: FormData) {
  const actor = await getAdminSession();
  if (!actor) redirect("/login?next=%2Fadmin%2Fphoto-va-contacts");
  if (!canManagePhotoVaContacts(actor, process.env.PHOTO_VA_WORKSPACE_ID)) redirect("/admin");
  const contact = readPhotoVaContactForm(formData);
  if (!contact) return status("invalid");

  const { workspaceId, userId } = actor;
  const { teamMemberId, enabled } = contact;
  let outcome: "saved" | "missing" | "limit" | "unavailable";
  try {
    if (!enabled) {
      const result = await prisma.photoVaContact.updateMany({
        where: { workspaceId, teamMemberId },
        data: { enabled: false, updatedById: userId },
      });
      outcome = result.count ? "saved" : "missing";
    } else {
      outcome = await prisma.$transaction(async tx => {
        if (!await tx.teamMember.findUnique({ where: { id: teamMemberId }, select: { id: true } })) return "missing";
        const pair = { workspaceId, teamMemberId };
        const current = await tx.photoVaContact.findUnique({
          where: { workspaceId_teamMemberId: pair },
          select: { enabled: true },
        });
        if (!current?.enabled && await tx.photoVaContact.count({ where: { workspaceId, enabled: true } }) >= MAX_PHOTO_VA_RECIPIENTS) return "limit";
        const contactData = { email: contact.email, enabled: true, updatedById: userId };
        await tx.photoVaContact.upsert({
          where: { workspaceId_teamMemberId: pair },
          create: { ...pair, ...contactData },
          update: contactData,
        });
        return "saved";
      }, { isolationLevel: "Serializable" });
    }
  } catch {
    outcome = "unavailable";
  }
  revalidatePath(path);
  return status(outcome);
}
