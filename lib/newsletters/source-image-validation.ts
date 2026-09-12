import "server-only";
import { collectVerifiedNewsletterSources } from "./content-sources";

type Source = { sourceType: string; sourceId: string | null };
type Selection = { candidateId: string | undefined; url: string; sources: Source[] };

function sourceIdentity(source: Source) {
  const prefix = { BLOG_POST: "blog:", PROJECT: "project:", SERVICE: "service:" }[source.sourceType];
  if (!prefix || !source.sourceId?.startsWith(prefix)) return null;
  const id = source.sourceId.slice(prefix.length);
  return id ? { type: source.sourceType, id, sourceId: source.sourceId } : null;
}

/** Refresh only server-persisted source identities, never the submitted candidate manifest. */
export async function verifyNewsletterSourceImageSelections(workspaceId: string, selections: Selection[]) {
  if (!selections.length) return;
  const references = selections.flatMap(selection => selection.sources.flatMap(source => {
    const identity = sourceIdentity(source);
    return identity ? [identity] : [];
  }));
  const ids = (type: string) => [...new Set(references.filter(source => source.type === type).map(source => source.id))];
  const sources = await collectVerifiedNewsletterSources(workspaceId, {
    blogPostIds: ids("BLOG_POST"), projectIds: ids("PROJECT"), serviceIds: ids("SERVICE"),
  });
  for (const selection of selections) {
    const allowed = new Set(selection.sources.flatMap(source => {
      const identity = sourceIdentity(source);
      return identity ? [identity.sourceId] : [];
    }));
    const valid = sources.some(source => allowed.has(source.id) && source.imageCandidates?.some(candidate =>
      candidate.id === selection.candidateId && candidate.url === selection.url
    ));
    if (!valid) throw new Error("The selected source image is no longer available.");
  }
}
