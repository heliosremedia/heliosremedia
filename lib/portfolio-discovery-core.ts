export type PortfolioOrderingMode = "CURATED" | "NEWEST" | "ROTATING_MIX";

export type DiscoveryAsset = {
  id: string;
  projectId: string;
  projectOrder: number;
  mediaOrder: number;
  createdAt: Date | string;
  aspectRatio: number | null;
};

export const MEDIA_INTENT_ANCHORS: Record<string, string> = {
  photography: "photography-gallery",
  "drone-photography": "drone-photography-gallery",
  "cinematic-films": "cinematic-films",
  "agent-branding": "agent-branded-films",
  "ai-cinematic-films": "ai-cinematic-films",
  "vertical-reels": "vertical-reels",
  "social-content": "social-content",
  "twilight-photography": "twilight-photography-gallery",
};

export function mediaIntentAnchor(serviceSlug: string | null | undefined) {
  if (!serviceSlug) return null;
  return MEDIA_INTENT_ANCHORS[serviceSlug] || `${serviceSlug.replace(/[^a-z0-9-]/g, "-")}-collection`;
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function ratioBucket(ratio: number | null) {
  if (!ratio) return 1;
  if (ratio < 0.86) return 2;
  if (ratio > 1.55) return 0;
  return 1;
}

export function orderDiscoveryAssets<T extends DiscoveryAsset>(
  assets: T[],
  mode: PortfolioOrderingMode,
  seed: string,
) {
  const unique = [...new Map(assets.map((asset) => [asset.id, asset])).values()];
  if (mode === "CURATED") {
    return unique.toSorted((a, b) => a.projectOrder - b.projectOrder || a.mediaOrder - b.mediaOrder || a.id.localeCompare(b.id));
  }
  if (mode === "NEWEST") {
    return unique.toSorted((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || a.id.localeCompare(b.id));
  }

  const byProject = new Map<string, T[]>();
  for (const asset of unique) {
    const group = byProject.get(asset.projectId) || [];
    group.push(asset);
    byProject.set(asset.projectId, group);
  }
  const projectGroups = [...byProject.entries()]
    .map(([projectId, group]) => ({
      projectId,
      group: group.toSorted((a, b) => hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`)),
    }))
    .toSorted((a, b) => hash(`${seed}:${a.projectId}`) - hash(`${seed}:${b.projectId}`));

  const ordered: T[] = [];
  let round = 0;
  while (ordered.length < unique.length) {
    let added = false;
    for (const project of projectGroups) {
      const asset = project.group[round];
      if (!asset) continue;
      const previous = ordered.at(-1);
      if (previous?.projectId === asset.projectId && projectGroups.length > 1) continue;
      ordered.push(asset);
      added = true;
    }
    if (!added) {
      for (const project of projectGroups) {
        const asset = project.group[round];
        if (asset && !ordered.some((item) => item.id === asset.id)) ordered.push(asset);
      }
    }
    round += 1;
  }
  const pending = [...ordered];
  const balanced: T[] = [];
  while (pending.length) {
    const previous = balanced.at(-1);
    let nextIndex = pending.findIndex((candidate) => candidate.projectId !== previous?.projectId && !(ratioBucket(previous?.aspectRatio ?? null) === 2 && ratioBucket(candidate.aspectRatio) === 2));
    if (nextIndex < 0) nextIndex = pending.findIndex((candidate) => candidate.projectId !== previous?.projectId);
    if (nextIndex < 0) nextIndex = 0;
    balanced.push(pending.splice(nextIndex, 1)[0]);
  }
  return balanced;
}

export function stableRotationSeed(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function gallerySlice<T>(items: T[], offset: number, count: number) {
  const safeOffset = Math.max(0, Math.floor(offset));
  const safeCount = Math.min(48, Math.max(6, Math.floor(count)));
  return {
    items: items.slice(safeOffset, safeOffset + safeCount),
    nextOffset: safeOffset + safeCount < items.length ? safeOffset + safeCount : null,
    total: items.length,
  };
}
