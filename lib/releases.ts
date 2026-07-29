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
    version: "V1.8.9.12",
    slug: "v1-8-9-12",
    releaseDate: null,
    title: "Referral Verified-Sender Recovery",
    summary: "Recovers the exact zero-send referral campaign without assuming a provider-dependent failed/approved status split.",
    newFeatures: [],
    improvements: [
      "Uses immutable incident audit history and delivery evidence to authorize the one-time recovery",
    ],
    bugFixes: [
      "Removes the invalid one-failed/148-approved assumption that blocked the verified sender repair",
      "Pins the saved campaign sender to referrals@mail.heliosrealestatemedia.com before queueing",
    ],
    securityInfrastructure: [
      "Recovery requires the exact named 149-person campaign, prior containment and recovery audits, and zero sent/provider-message evidence",
      "The existing provider fail-stop remains active for every delivery batch",
    ],
    administratorActions: [
      "Deployment creates one fresh execution authorization for normal bounded cron processing.",
      "Do not manually retry, reschedule, or cancel while the recovered queue is processing.",
    ],
    status: "DEPLOYING",
  },
  {
    version: "V1.8.9.11",
    slug: "v1-8-9-11",
    releaseDate: null,
    title: "Referral Sender Recovery",
    summary: "Repairs the referral campaign's stored sender domain and safely recovers its zero-send audience.",
    newFeatures: [],
    improvements: [
      "Pins the campaign sender to the verified Resend subdomain used by successful test delivery",
    ],
    bugFixes: [
      "Stops a saved campaign sender from overriding the corrected production sender configuration",
      "Recovers the one failed and 148 suppressed invitations into one executable queue",
    ],
    securityInfrastructure: [
      "Recovery requires exactly 149 invitation communications, one failed record, 148 approved records, and zero sent/provider-message evidence",
      "The provider fail-stop remains active and revokes execution immediately if Resend rejects delivery",
    ],
    administratorActions: [
      "Deployment creates a fresh execution authorization for normal bounded cron processing.",
      "Do not reschedule, cancel, or use Retry Safely while the recovered queue is processing.",
    ],
    status: "LIVE",
  },
  {
    version: "V1.8.9.10",
    slug: "v1-8-9-10",
    releaseDate: null,
    title: "Referral Zero-Send Recovery",
    summary: "Restores the verified 149-person referral campaign to an executable queue after the sender-domain repair.",
    newFeatures: [],
    improvements: [
      "Exact-state recovery aligns all prepared invitation records with the campaign's authorized schedule",
    ],
    bugFixes: [
      "Repairs the mismatch where a campaign could show 149 queued while no invitation communications were due",
    ],
    securityInfrastructure: [
      "Recovery requires the exact 9:36 PM schedule, 149 invitation communications, 50 historical failures, and zero sent/provider-message evidence",
      "The V1.8.9.9 provider fail-stop remains active for every recovered delivery attempt",
    ],
    administratorActions: [
      "Deployment intentionally releases the overdue invitations to the normal bounded cron worker.",
      "Do not reschedule, cancel, or use Retry Safely while the recovered queue is processing.",
    ],
    status: "PLANNED",
  },
  {
    version: "V1.8.9.9",
    slug: "v1-8-9-9",
    releaseDate: null,
    title: "Referral Provider Failure Containment",
    summary: "Contains the zero-send provider failure and prevents a rejected batch from releasing later invitations.",
    newFeatures: [
      "Sanitized referral provider failure categories without credentials, provider bodies, or recipient data",
    ],
    improvements: [
      "A provider rejection now revokes the campaign schedule authorization immediately",
      "Unclaimed invitations return to an approved non-executable state while failed records remain preserved",
    ],
    bugFixes: [
      "Prevents later cron polls from claiming the remaining audience after a provider batch failure",
    ],
    securityInfrastructure: [
      "Exact 8:45 PM containment requires 149 prepared advocates, exactly 50 failed communications, and zero sent/provider-message evidence",
      "A new explicit schedule is required after provider configuration is verified",
    ],
    administratorActions: [
      "Do not retry or reschedule until the Resend credential and sender domain are verified.",
      "Keep all provider validation non-sending and preserve the 50 failed records.",
    ],
    status: "PLANNED",
  },
  {
    version: "V1.8.9.8",
    slug: "v1-8-9-8",
    releaseDate: null,
    title: "Referral Cron Credential Recovery",
    summary: "Contains the second zero-send referral authorization before the protected production cron credential is rotated.",
    newFeatures: [],
    improvements: [
      "Adds a second exact-schedule containment checkpoint for the July 28 7:54 PM authorization",
    ],
    bugFixes: [
      "Prevents the newly overdue schedule from becoming executable when production cron authentication is restored",
    ],
    securityInfrastructure: [
      "Containment targets only the named 149-advocate campaign and exact one-minute schedule window",
      "The migration refuses to alter any campaign with sent or provider-submitted communication evidence",
      "Cron authentication remains fail-closed until the protected Vercel production credential is rotated",
    ],
    administratorActions: [
      "Do not retry, edit, cancel, or reschedule the campaign.",
      "Rotate CRON_SECRET in Vercel Production only after this containment migration is deployed.",
      "Require an authenticated zero-send normal cron poll before creating a new schedule.",
    ],
    status: "PLANNED",
  },
  {
    version: "V1.8.9.7",
    slug: "v1-8-9-7",
    releaseDate: null,
    title: "Referral Cron Authentication Recovery",
    summary: "Contains the overdue zero-send referral schedule before correcting the exact Vercel cron authorization contract.",
    newFeatures: [
      "Sanitized cron-authentication diagnostics distinguish missing configuration, missing authorization, and credential mismatch",
    ],
    improvements: [
      "Referral cron authentication now compares Vercel's Bearer credential exactly and consistently",
      "The known overdue schedule is contained through a narrowly scoped, idempotent deployment migration",
    ],
    bugFixes: [
      "Removes asymmetric secret trimming that could reject Vercel's otherwise valid cron authorization",
    ],
    securityInfrastructure: [
      "Containment refuses to alter the campaign if any sent or provider evidence exists",
      "No cron credential, authorization header, recipient content, or provider data is recorded",
    ],
    administratorActions: [
      "Do not reschedule until a normal Vercel invocation reports authenticated zero-send execution.",
      "Create a completely new schedule only after V1.8.9.7 is finalized LIVE.",
    ],
    status: "PLANNED",
  },
  {
    version: "V1.8.9.6",
    slug: "v1-8-9-6",
    releaseDate: "2026-07-28",
    title: "Referral Delivery Execution & Observability",
    summary: "Contains the expired referral authorization, preserves truthful overdue states, and adds durable cron and worker evidence.",
    newFeatures: [
      "Due / Queued and Stalled operational states with a bounded worker grace period",
      "Persistent cron invocation outcomes and delivery-count evidence in Referral Studio",
    ],
    improvements: [
      "A new explicit schedule authorizes execution; legacy expired schedules remain inert",
      "Zero-send cron runs are distinguishable from missing worker activity and provider failures",
    ],
    bugFixes: [
      "Overdue confirmed schedules no longer revert visually to Approved — Not Scheduled",
      "Cron runs now leave durable evidence even when no communication is sent",
    ],
    securityInfrastructure: [
      "Additive execution-authorization gate prevents the expired July 28 schedule from being claimed after deployment",
      "Cron authentication failures and sanitized terminal errors are recorded without secrets or email content",
    ],
    administratorActions: [
      "Verify the expired campaign is Approved — Not Scheduled before creating a new schedule.",
      "Choose a new future time only after reviewing cron evidence and the complete 149-advocate audience.",
    ],
    status: "LIVE",
  },
  {
    version: "V1.8.9.5",
    slug: "v1-8-9-5",
    releaseDate: "2026-07-28",
    title: "Referral Scheduling Completion",
    summary: "Completes deliberate, versioned referral schedule review, editing, cancellation, and truthful legacy-state containment.",
    newFeatures: [
      "Review & Schedule action for every prepared campaign whose truthful state is Approved — Not Scheduled",
      "Versioned schedule editing and cancellation that preserve sent history",
      "Full four-message review with explicit advocate-to-message calculation and follow-up timing",
    ],
    improvements: [
      "Next send is authoritative only when the complete scheduling approval contract is valid",
      "Scheduling review can be saved or closed without creating delivery work",
    ],
    bugFixes: [
      "Legacy raw Active status can no longer hide Review & Schedule",
      "Provisional follow-up timestamps no longer appear as an authorized next send",
    ],
    securityInfrastructure: [
      "Worker execution requires matching approval revision, audience snapshot, time zone, confirmation, and due time",
      "Schedule creation, editing, and cancellation are transactional, idempotent, audited, and workspace-authorized",
    ],
    administratorActions: [
      "Open Review & Schedule and inspect all four approved messages before choosing a future time.",
      "Do not confirm the production schedule until the internal test is separately authorized and completed.",
    ],
    status: "LIVE",
  },
  {
    version: "V1.8.9.4",
    slug: "v1-8-9-4",
    releaseDate: "2026-07-28",
    title: "Referral Campaign Scheduling & Visibility",
    summary: "Separates safe campaign preparation from explicitly approved delivery scheduling and makes every next action visible.",
    newFeatures: [
      "Review & Schedule confirmation with future first-send time and workspace time zone",
      "Operational campaign summary with truthful next-send, sequence, worker, and provider activity",
    ],
    improvements: [
      "Dashboard metrics distinguish active, awaiting-scheduling, scheduled, paused, and stalled campaigns",
      "Sequence totals clearly separate unique advocates from estimated messages",
    ],
    bugFixes: [
      "Prepared campaigns with no confirmed schedule no longer appear Active",
      "Campaign preparation no longer creates runnable communications",
    ],
    securityInfrastructure: [
      "Delivery requires an explicit schedule-confirmation timestamp before a worker can claim work",
      "Scheduling is idempotent and campaign operational queries remain workspace-scoped",
    ],
    administratorActions: [
      "Review the prepared audience, sender, content, sequence, and proposed time before confirming a schedule.",
      "Do not schedule the production audience until an authorized internal test has been completed.",
    ],
    status: "LIVE",
  },
  {
    version: "V1.8.9.3",
    slug: "v1-8-9-3",
    releaseDate: "2026-07-28",
    title: "Referral Launch Processor Recovery",
    summary: "Connects every claimed Referral Studio launch to reliable server-side campaign preparation.",
    newFeatures: [
      "Vercel-supported background launch processing through Next.js after()",
      "Structured processor, batch, failure, completion, and stale-attempt operational logs",
    ],
    improvements: [
      "Immediate processing lease acquisition and renewal after every completed batch",
      "Visible server-side progress that continues when the administrator leaves the page",
    ],
    bugFixes: [
      "Launch and Retry Safely now start the existing referral preparation processor",
      "Failed preparation records sanitized errors and verified committed counts immediately",
    ],
    securityInfrastructure: [
      "Attempt-ID ownership rejects stale or duplicate processors",
      "Existing recipient uniqueness, idempotency keys, bounded batches, and completion verification remain enforced",
    ],
    administratorActions: [
      "Verify the stalled campaign has no sent communications before recovery.",
      "Use Retry Safely and confirm all approved advocates are prepared before considering the campaign recovered.",
    ],
    status: "LIVE",
  },
  {
    version: "V1.8.9.2",
    slug: "v1-8-9-2",
    releaseDate: "2026-07-28",
    title: "Site Settings, Brand Sharing & Homepage Polish",
    summary: "Completes the Site Settings hierarchy and adds workspace-aware, project-focused social sharing previews.",
    newFeatures: [
      "Configurable 1200 × 630 workspace social share image",
      "Project share-preview selection with project imagery before workspace branding",
    ],
    improvements: [
      "Unified Brand Assets, responsive Booking Handoff, and aligned Homepage hero media cards",
      "Clear Business Identity, Booking Experience, Content & Discovery, and Legal & Privacy navigation",
    ],
    bugFixes: [
      "Brand monograms are now the final emergency project-sharing fallback",
      "Long Homepage media paths no longer break the editor layout",
    ],
    securityInfrastructure: [
      "Workspace settings and project media remain server-authorized and tenant-scoped",
      "Stable versioned preview URLs update only when the managed share image changes",
    ],
    administratorActions: [
      "Review the workspace default social share image before publishing the hotfix.",
      "Refresh a newly shared project link to validate current Open Graph metadata after deployment.",
    ],
    status: "LIVE",
  },
  {
    version: "V1.8.9.1",
    slug: "v1-8-9-1",
    releaseDate: "2026-07-28",
    title: "Post-Release QA & Operational Recovery",
    summary: "Completes post-release operational safeguards and refines core Studio workflows without releasing the contained referral campaign.",
    newFeatures: [
      "Confirmed, permission-restricted zero-delivery referral recovery controls",
      "Blog structure preview, comparison, confirmation, and pre-publish guidance",
      "Context-derived newsletter image direction and clear edition exit workflows",
    ],
    improvements: [
      "Focused Client Entry Points editing with unsaved-change and focus safeguards",
      "Scalable Blog Studio article search, status filtering, contained scrolling, and load-more controls",
      "Inline Homepage hero preview, full-width imagery, and coherent Site Settings information architecture",
    ],
    bugFixes: [
      "Long newsletter titles wrap without crowding status or edition actions",
      "Core business and contact settings now precede booking, content, and legal configuration",
    ],
    securityInfrastructure: [
      "Contained referral launches cannot silently resume and still require fresh human confirmation",
      "Existing tenant scoping, immutable delivery history, sanitized diagnostics, and analytics privacy controls remain enforced",
    ],
    administratorActions: [
      "Complete authenticated read-only referral and provider verification before any campaign recovery.",
      "Complete one controlled signed-out Portfolio Intelligence event after deployment.",
    ],
    status: "LIVE",
  },
  {
    version: "V1.8.9",
    slug: "v1-8-9",
    releaseDate: "2026-07-28",
    title: "Homepage Curation & Portfolio Intelligence Recovery",
    summary: "Refines Homepage Curation and restores accurate, privacy-conscious Portfolio Intelligence ingestion and health reporting.",
    newFeatures: [
      "Dedicated Homepage Media, Availability Message, and full-width Homepage Copy workspaces",
      "User-initiated hero video and poster previews",
      "Sanitized public analytics health reporting across configuration, ingestion, storage, and reporting",
    ],
    improvements: [
      "Clear page-level dirty, saving, saved, error, and upload progress states",
      "Responsive homepage editors with intentional long-media metadata handling",
      "Database-confirmed analytics receipts and bounded retry behavior",
    ],
    bugFixes: [
      "Persistence failures now return accurate server-error statuses instead of accepted responses",
      "One-time public events are suppressed only after confirmed storage",
      "Availability guidance clarifies its relationship to authoritative global booking controls",
    ],
    securityInfrastructure: [
      "Health responses expose sanitized categories without database, tenant, session, or connection details",
      "Existing tenant-scoped analytics writes, idempotency, and privacy filtering remain enforced",
    ],
    administratorActions: [
      "Complete a controlled signed-out production event after deployment and confirm it in Portfolio Intelligence.",
      "Review the stalled referral campaign only through sanitized read-only diagnostics.",
    ],
    status: "LIVE",
  },
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
