import "server-only";
import type { NewsletterSourceReference } from "./ai";
import { collectVerifiedNewsletterSources } from "./content-sources";

type StoredSource = { id: string; sourceId: string | null; sourceType: string };

/** Only authored copy belongs in rewrite context; cached image/source metadata does not. */
export function newsletterBlockAuthoringContext(content: Record<string, unknown>) {
  return Object.fromEntries(["eyebrow", "heading", "body", "link", "buttonLabel", "alignment"]
    .flatMap(key => typeof content[key] === "string" ? [[key, content[key].slice(0, 10_000)]] : []));
}

export async function refreshNewsletterBlockSources(
  workspaceId: string, stored: StoredSource[], content: Record<string, unknown>,
): Promise<NewsletterSourceReference[]> {
  const identities = stored.map(source => {
    if (source.sourceType === "ADMIN_CONTENT") return { source, kind: "ADMIN_CONTENT", id: source.id };
    if (source.sourceType === "WEBSITE_CONTENT" && source.sourceId === "website:site-settings") return { source, kind: "WEBSITE_CONTENT", id: "site-settings" };
    const prefix = { BLOG_POST: "blog:", PROJECT: "project:", SERVICE: "service:" }[source.sourceType];
    if (!prefix || !source.sourceId?.startsWith(prefix) || !source.sourceId.slice(prefix.length)) {
      throw new Error("Newsletter source identity must be verified before rewriting.");
    }
    return { source, kind: source.sourceType, id: source.sourceId.slice(prefix.length) };
  });
  const ids = (kind: string) => [...new Set(identities.filter(item => item.kind === kind).map(item => item.id))];
  const verified = identities.some(item => item.kind !== "ADMIN_CONTENT") ? await collectVerifiedNewsletterSources(workspaceId, {
    blogPostIds: ids("BLOG_POST"), projectIds: ids("PROJECT"), serviceIds: ids("SERVICE"),
    includeWebsiteContent: identities.some(item => item.kind === "WEBSITE_CONTENT"),
  }) : [];
  return identities.map(({ source, kind }) => {
    if (kind === "ADMIN_CONTENT") return {
      id: `block-source:${source.id}`, kind, label: "Administrator-provided content",
      excerpt: Object.values(newsletterBlockAuthoringContext(content)).join("\n").slice(0, 4_000),
      imageCandidates: [],
    };
    const reference = verified.find(item => item.id === source.sourceId && item.kind === kind);
    if (!reference) throw new Error("Newsletter source is no longer available to this company.");
    return reference;
  });
}
