import { PROJECT_WRITING_SOURCE_LIMIT, projectWritingFields, type ProjectWritingDraft } from "./project-writing";

export function parseCopyPackage(value: unknown): { source: string; draft: ProjectWritingDraft } {
  if (!value || typeof value !== "object") throw Error("Invalid copy package.");
  const input = value as Record<string, unknown>;
  if (typeof input.source !== "string" || input.source.length > PROJECT_WRITING_SOURCE_LIMIT || !input.draft || typeof input.draft !== "object" || Array.isArray(input.draft)) throw Error("Invalid copy package.");
  const fields = input.draft as Record<string, unknown>;
  const draft = {} as ProjectWritingDraft;
  for (const { key, max } of projectWritingFields) {
    if (typeof fields[key] !== "string" || fields[key].length > max) throw Error("Invalid copy package.");
    draft[key] = fields[key];
  }
  return { source: input.source, draft };
}
