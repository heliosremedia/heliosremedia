"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export type CreateProjectState = {
  error: string | null;
};

function getString(formData: FormData, field: string) {
  const value = formData.get(field);

  return typeof value === "string" ? value.trim() : "";
}

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
  const title = getString(formData, "title");
  const requestedSlug = getString(formData, "slug");
  const shortDescription = getString(
    formData,
    "shortDescription",
  );
  const city = getString(formData, "city");
  const state = getString(formData, "state");
  const locationLabel = getString(formData, "locationLabel");
  const projectType = getString(formData, "projectType");
  const propertyType = getString(formData, "propertyType");

  if (!title) {
    return {
      error: "Enter a project title before continuing.",
    };
  }

  const slug = await createUniqueSlug(requestedSlug || title);

  let projectId: string;

  try {
    const project = await prisma.project.create({
      data: {
        title,
        slug,
        shortDescription: shortDescription || null,
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

  redirect(`/admin/projects/${projectId}`);
}