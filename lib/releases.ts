export type ReleaseStatus = "LIVE" | "DEPLOYING" | "PLANNED";

export type StudioRelease = {
  version: string;
  slug: string;
  releaseDate: string | null;
  title: string;
  summary: string;
  newFeatures: string[];
  improvements: string[];
  bugFixes: string[];
  securityInfrastructure: string[];
  administratorActions: string[];
  status: ReleaseStatus;
};

// Release history is deliberately code-controlled. Earlier releases are not
// backfilled here unless their details can be confirmed from authoritative
// repository records.
export const STUDIO_RELEASES: readonly StudioRelease[] = [
  {
    version: "V1.8.6.1",
    slug: "v1-8-6-1",
    releaseDate: "2026-07-27",
    title: "Portfolio Sharing Production Hotfix",
    summary: "Reliable project images and complete server-rendered metadata for Facebook, LinkedIn, X, messaging, and other Open Graph consumers.",
    newFeatures: [
      "Explicit Social Sharing Image selection in Project Management",
      "Shared server-side social-image resolver with a durable global fallback",
    ],
    improvements: [
      "Complete absolute Open Graph and large-image Twitter metadata",
      "Validated hero, gallery, and video-thumbnail fallback selection",
    ],
    bugFixes: [
      "Prevents blank social previews when a project hero is unavailable",
      "Excludes hidden, unsupported, video, and preview-only media from published metadata",
    ],
    securityInfrastructure: [
      "Private previews and unpublished projects remain noindex and expose no public social metadata",
      "Published share URLs remain canonical and free of preview tokens",
    ],
    administratorActions: [
      "Optionally choose a Social Sharing Image for projects that need a specific share composition.",
      "Use each platform's re-scrape tool when an older shared URL remains cached.",
    ],
    status: "LIVE",
  },
  {
    version: "V1.8.6",
    slug: "v1-8-6",
    releaseDate: "2026-07-27",
    title: "Portfolio Intelligence & Platform Visibility",
    summary: "Privacy-conscious portfolio reporting, code-driven release visibility, refined contributor identity, and corrected public filters.",
    newFeatures: [
      "First-party Portfolio Intelligence with dashboard and per-project insights",
      "Code-controlled Administration Release Notes",
      "Separate professional titles for administrator profiles and public project credits",
    ],
    improvements: [
      "Accessible contributor search and distinct selected-contributor presentation",
      "Project share, gallery, video, CTA, source, and device measurement",
      "Compact shared Portfolio and Services filter controls",
    ],
    bugFixes: [
      "Corrected oversized public filter proportions and label centering",
      "Preserved contributor attribution after account deactivation",
    ],
    securityInfrastructure: [
      "Server-derived workspace ownership and tenant-isolated analytics reporting",
      "Validated, rate-limited, idempotent analytics ingestion without fingerprinting",
      "Conservative and auditable legacy display-name migration",
    ],
    administratorActions: [
      "Review any legacy profiles that could not be split unambiguously.",
      "Add missing professional titles where Studio Admin identifies them.",
    ],
    status: "LIVE",
  },
] as const;

export function getStudioRelease(slug: string) {
  return STUDIO_RELEASES.find(release => release.slug === slug) ?? null;
}
