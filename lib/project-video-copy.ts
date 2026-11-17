import type { ProjectWritingDraft } from "./project-writing";
export const PROJECT_WRITING_REQUEST_EVENT = "helios:project-writing-request";
export type WritingCopyRequest = { projectId: string; draft: ProjectWritingDraft | null };
export function videoCopyFields(draft: ProjectWritingDraft) {
  return { title: draft.videoTitle, altText: draft.videoAltText, caption: draft.videoCaption };
}
