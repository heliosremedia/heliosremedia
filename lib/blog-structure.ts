export type BlogStructureIssue =
  | "duplicate-title"
  | "empty-heading"
  | "malformed-list"
  | "missing-sections"
  | "long-section";

export function inspectBlogStructure(title: string, markdown: string): BlogStructureIssue[] {
  const issues = new Set<BlogStructureIssue>();
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const normalizedTitle = title.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const headings = lines.filter((line) => /^#{1,6}\s+/.test(line));
  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s*(.*)$/)?.[1]?.trim() ?? "";
    if (/^#{1,6}\s*$/.test(line)) issues.add("empty-heading");
    if (/^#\s+/.test(line) && heading.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() === normalizedTitle) {
      issues.add("duplicate-title");
    }
    if (/^\s*\d+[.)]\S/.test(line) || /^\s*[-*+]\S/.test(line)) issues.add("malformed-list");
  }
  if (markdown.trim().length > 700 && !headings.some((line) => /^##\s+/.test(line))) issues.add("missing-sections");
  const sections = markdown.split(/^##\s+/m);
  if (sections.some((section) => section.replace(/\s+/g, " ").trim().length > 1_400)) issues.add("long-section");
  return [...issues];
}

export const BLOG_STRUCTURE_LABELS: Record<BlogStructureIssue, string> = {
  "duplicate-title": "Remove the duplicated title heading from the article body.",
  "empty-heading": "Complete or remove empty Markdown headings.",
  "malformed-list": "Add a space after list markers so lists render correctly.",
  "missing-sections": "Add meaningful ## section headings for scanability.",
  "long-section": "Break unusually long sections into readable paragraphs or subsections.",
};
