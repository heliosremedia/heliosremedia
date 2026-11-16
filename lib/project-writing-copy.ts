import { projectWritingFields, type ProjectWritingDraft } from "./project-writing";

/** Copy the current editor values verbatim, without regenerating or applying them. */
export function formatAllProjectWriting(draft: ProjectWritingDraft): string {
  return projectWritingFields.map(({ key, label }) => `${label}\n${draft[key]}`).join("\n\n");
}
