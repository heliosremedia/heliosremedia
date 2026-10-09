"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth/session";
import { createProjectDraft, type ProjectDraftInput } from "@/lib/project-draft";

export type CreateProjectState = { error: string | null; projectId?: string; requiresReview?: boolean };

export async function createProject(_previousState: CreateProjectState, formData: FormData): Promise<CreateProjectState> {
  const session = await requireAdminSession();
  if (!["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return { error: "Editor access is required.", requiresReview: true };
  const get = (field: string) => typeof formData.get(field) === "string" ? (formData.get(field) as string).trim() : "";
  const input: ProjectDraftInput = { title: get('title'), slug: get('slug'), shortDescription: get('shortDescription'), city: get('city'), state: get('state'), locationLabel: get('locationLabel'), projectType: get('projectType'), propertyType: get('propertyType') };
  try {
    const result = await createProjectDraft(session, get('requestId'), input);
    revalidatePath('/admin'); revalidatePath('/admin/projects'); revalidatePath('/admin/studio');
    return { error: null, projectId: result.id };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'PROJECT_DRAFT_TITLE_REQUIRED') return { error: 'Enter a project title before continuing.' };
      if (error.message === 'PROJECT_DRAFT_INPUT_INVALID') return { error: 'One or more project fields exceed their allowed length. Review the form and try again.' };
      if (error.message === 'WORKSPACE_WRITE_FORBIDDEN') return { error: 'Your workspace access changed. Check your access before creating a project.', requiresReview: true };
      if (error.message === 'PROJECT_DRAFT_REQUEST_INVALID') return { error: 'Reload this form before creating a project. Copy any text you need first.', requiresReview: true };
    }
    console.error('Unable to confirm project creation:', error);
    return { error: 'The creation result could not be confirmed. Your form is preserved. Check Projects before starting another draft.', requiresReview: true };
  }
}
