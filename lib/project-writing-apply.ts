import { isProjectWritingApplication, projectWritingFields, type ProjectWritingApplication, type ProjectWritingDraft, type ProjectWritingTarget } from "./project-writing";

/** Snapshot only fields with real destinations. Blank suggestions never clear existing copy. */
export function projectWritingApplications(draft: ProjectWritingDraft, projectId: string | undefined, projectFieldsOnly: boolean, videoTarget: ProjectWritingTarget): ProjectWritingApplication[] {
  return projectWritingFields.flatMap(({ key }) => {
    if (key.startsWith("youtube") || (projectFieldsOnly && key.startsWith("video")) || !draft[key].trim()) return [];
    const application = { projectId, field: key, value: draft[key], target: key.startsWith("video") ? videoTarget : "project" };
    return isProjectWritingApplication(application) ? [application] : [];
  });
}
