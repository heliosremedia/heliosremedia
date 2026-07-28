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
    version: "V1.8.8",
    slug: "v1-8-8",
    releaseDate: "2026-07-28",
    title: "Stabilization & Experience Refinements",
    summary: "Repairs Portfolio Intelligence ingestion confirmation and Referral Studio launch recovery while refining core Studio and public experiences.",
    newFeatures: [
      "Explicit stalled-referral recovery with Stop Preparation, Return to Approved, Retry Safely, and Cancel safeguards",
      "Database-confirmed Portfolio Intelligence delivery and truthful analytics health",
    ],
    improvements: [
      "Referral lifecycle progress, approved audience, delivery counts, and next-action guidance",
      "Focused Blog Studio, Site Settings, Client Portal, Email Studio, and responsive public refinements",
      "Consistent booking controls and accessible public navigation behavior",
    ],
    bugFixes: [
      "Prevents browser-queued analytics requests from being marked stored before database confirmation",
      "Prevents days-old referral launches from automatically resuming without fresh human confirmation",
      "Corrects deployed V1.8.7 and V1.8.7.1 release states",
    ],
    securityInfrastructure: [
      "Tenant-scoped analytics reporting and campaign recovery authorization",
      "No recipient details, raw visitor identifiers, or sensitive URLs in operational diagnostics",
    ],
    administratorActions: [
      "Review stalled campaign counts before choosing any recovery action.",
      "Complete controlled signed-out analytics QA before production approval.",
    ],
    status: "LIVE",
  },
  {
    version: "V1.8.7.1",
    slug: "v1-8-7-1",
    releaseDate: "2026-07-27",
    title: "Workspace Accounts Repair",
    summary: "Restores clear account identity, compact responsive controls, and durable workspace-owner protections.",
    newFeatures: [],
    improvements: [
      "Display name, email, professional title, and permission role now have a clear information hierarchy",
      "Compact desktop account rows become intentional touch-friendly cards on mobile and tablet widths",
      "Account action feedback and disabled-control explanations are accessible",
    ],
    bugFixes: [
      "Restored visible account names and email addresses without destructive truncation",
      "Corrected oversized, poorly aligned role and account-action controls",
      "Prevents workspace-owner deactivation or demotion through the general account editor",
    ],
    securityInfrastructure: [
      "Server-enforced workspace-owner protection complements disabled interface controls",
      "Workspace-scoped account lookup continues to reject altered cross-tenant account identifiers",
    ],
    administratorActions: [],
    status: "LIVE",
  },
  {
    version: "V1.8.7",
    slug: "v1-8-7",
    releaseDate: "2026-07-27",
    title: "AI Social Series",
    summary: "Expands Social Studio into a human-reviewed campaign and recurring editorial planning workspace.",
    newFeatures: [
      "Reusable Social Series with retry-safe planned occurrences",
      "Independent Instagram, Facebook, LinkedIn, TikTok, and provider-neutral drafts",
      "Workspace-scoped campaign project and media relationships",
      "Human review, changes-requested, approval, and manual-publication records",
    ],
    improvements: [
      "AI-assisted platform drafts constrained to verified project facts",
      "Campaign duplication and reversible archiving",
      "Calendar and agenda filters for platform, series, and review status",
      "Clearly disclosed AI concept-image provenance",
    ],
    bugFixes: [],
    securityInfrastructure: [
      "Server-side workspace validation for project facts and selected media",
      "Idempotent recurring occurrence generation and approval invalidation after material edits",
      "No fabricated provider accounts, metrics, or publication confirmation",
    ],
    administratorActions: [
      "Review every AI-assisted draft before approval.",
      "Complete publication manually unless an existing, explicitly enabled provider connection is available.",
    ],
    status: "LIVE",
  },
  {
    version: "V1.8.6.2",
    slug: "v1-8-6-2",
    releaseDate: null,
    title: "Portfolio Intelligence Completion Hotfix",
    summary: "Completes reliable first-party portfolio measurement, tenant-safe ingestion, reporting discovery, and analytics health visibility.",
    newFeatures: [
      "Published-project reporting and zero-data Insights access",
      "Administrator analytics health state and detailed privacy-conscious breakdowns",
      "Project Management Insights actions",
    ],
    improvements: [
      "Reliable page-view delivery with sanitized operational outcomes",
      "Trusted host and project-based workspace resolution for multi-company operation",
      "Managed portfolio CTA measurement using stable identifiers",
    ],
    bugFixes: [
      "Corrected invalid page-view event identifiers that caused production requests to be rejected",
      "Prevents an arbitrary Site Settings record from receiving portfolio-level events",
    ],
    securityInfrastructure: [
      "No browser-supplied workspace identifiers, raw IPs, session identifiers, or sensitive URLs in diagnostics",
      "Tenant-isolated reporting and ambiguous-host rejection",
    ],
    administratorActions: [],
    status: "LIVE",
  },
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
