"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { readProjectCreateInput } from "@/lib/project-create-input";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth/session";

export type CreateProjectState = {
  error: string | null;
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function createUniqueSlug(value: string) {
  const baseSlug = slugify(value) || "project";

  let candidate = baseSlug;
  let suffix = 2;

  while (
    await prisma.project.findUnique({
      where: {
        slug: candidate,
      },
      select: {
        id: true,
      },
    })
  ) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function createProject(
  _previousState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const session = await requireAdminSession();
  if (!["OWNER", "ADMIN", "EDITOR"].includes(session.role)) {
    return { error: "Editor access is required to create a project." };
  }
  let input: ReturnType<typeof readProjectCreateInput>;
  try { input = readProjectCreateInput(formData); }
  catch (error) { return { error: error instanceof Error ? error.message : "Check the project details." }; }
  const { title, slug: requestedSlug, shortDescription, description, city, state, locationLabel, projectType, propertyType, propertyAddress } = input;

  const slug = await createUniqueSlug(requestedSlug || title);

  let projectId: string;

  try {
    const project = await prisma.project.create({
      data: {
        title,
        workspaceId: session.workspaceId,
        slug,
        shortDescription: shortDescription || null,
        description: description || null,
        ...(propertyAddress ? { details: { create: { propertyAddress } } } : {}),
        city: city || null,
        state: state || null,
        locationLabel: locationLabel || null,
        projectType: projectType || null,
        propertyType: propertyType || null,
        status: "DRAFT",
      },
      select: {
        id: true,
      },
    });

    projectId = project.id;
  } catch (error) {
    console.error("Unable to create project:", error);

    return {
      error:
        "The project could not be created. Please try again.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/projects");

  const handoff = formData.get("writingHandoff");
  const writingQuery = typeof handoff === "string" && handoff.length <= 200 ? `?writingHandoff=${encodeURIComponent(handoff)}` : "";
  redirect(`/admin/projects/${projectId}${writingQuery}`);
}
