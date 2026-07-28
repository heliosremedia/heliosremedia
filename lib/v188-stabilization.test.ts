import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("portfolio ingestion confirms storage before one-time suppression", () => {
  const client = read("app/components/PortfolioAnalytics.tsx");
  const route = read("app/api/portfolio-analytics/route.ts");
  assert.match(client, /result\?\.state === "stored"/);
  assert.match(client, /attempt < 2/);
  assert.doesNotMatch(client, /sendBeacon/);
  assert.match(route, /stored: true/);
  assert.match(route, /stored: false, category/);
});

test("referral cron cannot automatically resume a stale launch", () => {
  const launch = read("lib/referrals/launch.ts");
  const route = read("app/api/admin/referrals/campaigns/[campaignId]/route.ts");
  assert.match(launch, /launchStartedAt: \{ gte: recentLaunchCutoff \}/);
  assert.match(launch, /stopReferralCampaignPreparation/);
  assert.match(route, /return-to-approved/);
  assert.match(route, /retry-safe/);
  assert.match(route, /createdBy: \{ workspaceId: session\.workspaceId \}/);
});

test("every claimed referral launch queues the owned processor", () => {
  const launch = read("lib/referrals/launch.ts");
  const route = read("app/api/admin/referrals/campaigns/[campaignId]/route.ts");
  assert.match(route, /import \{ after, NextResponse \} from "next\/server"/);
  assert.match(route, /processReferralLaunch\(campaignId, launch\.attemptId\)/);
  assert.match(route, /body\.action === "launch" \|\| body\.action === "retry-safe"/);
  assert.match(route, /export const maxDuration = 300/);
  assert.doesNotMatch(route, /void processReferralLaunch/);
  assert.match(launch, /CAMPAIGN_LAUNCH_PROCESSOR_STARTED/);
  assert.match(launch, /launchAttemptId: attemptId/);
  assert.match(launch, /launchLeaseExpiresAt: new Date\(processingStartedAt\.getTime\(\) \+ LEASE_MS\)/);
  assert.match(launch, /\[referral-launch\] \$\{event\}/);
  assert.match(launch, /Retry Safely will continue from the existing prepared records/);
});

test("experience refinements preserve explicit user context", () => {
  const blog = read("app/admin/blog/BlogSeriesPanel.tsx");
  const portals = read("app/admin/client-portals/ClientPortalManager.tsx");
  const email = read("app/admin/email-studio/BulkEmailStudio.tsx");
  assert.match(blog, /Series created\./);
  assert.match(blog, /Series updated\./);
  assert.match(blog, /next draft generation/);
  assert.doesNotMatch(blog, /next publication/);
  assert.match(portals, /role=\{editing \? "dialog"/);
  assert.doesNotMatch(portals, /window\.scrollTo/);
  assert.match(email, /View Email/);
  assert.match(email, /Tracking pixels, remote images, and embedded content are not loaded/);
});

test("public navigation uses controlled SVG controls", () => {
  const navbar = read("app/components/Navbar.tsx");
  const gallery = read("app/portfolio/[slug]/PortfolioGallery.tsx");
  assert.doesNotMatch(navbar, /↗/);
  assert.match(gallery, /aria-label="Previous image"/);
  assert.match(gallery, /aria-label="Next image"/);
  assert.match(gallery, /stroke="currentColor"/);
});
