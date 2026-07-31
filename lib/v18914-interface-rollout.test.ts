import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("long admin pages expose scoped section navigation", () => {
  const navigator = read("app/admin/components/AdminSectionNavigator.tsx");
  const homepage = read("app/admin/homepage/page.tsx");
  const organizer = read("app/admin/homepage/HomepageCurationOrganizer.tsx");
  const about = read("app/admin/about/AboutPageManager.tsx");
  const project = read("app/admin/projects/[projectId]/page.tsx");
  assert.match(navigator, /aria-label=\{label\}/);
  assert.match(navigator, /Jump to Section/);
  assert.match(navigator, /auto-fit/);
  assert.doesNotMatch(navigator, /overflow-x-auto/);
  assert.match(homepage, /homepage-navigation/);
  assert.match(organizer, /label="Homepage Curation sections"/);
  assert.match(about, /#about-founder/);
  assert.match(project, /#project-media/);
  assert.match(project, /#project-publishing/);
});

test("Homepage Navigation Links are summarized and collapsed by default", () => {
  const page = read("app/admin/homepage/page.tsx");
  const layout = read("lib/homepage-curation-layout.ts");
  assert.ok(
    page.indexOf("homepage-navigation") < page.indexOf("homepage-media"),
  );
  assert.match(layout, /collapsed: \["homepage-navigation"\]/);
  assert.match(page, /\$\{uniqueLinks\.size\} total/);
  assert.match(page, /title: "Navigation Links"/);
});

test("Newsletter series precede secondary edition queues", () => {
  const source = read(
    "app/admin/newsletter-studio/components/NewsletterDashboard.tsx",
  );
  assert.ok(
    source.indexOf("Active Newsletter Series") <
      source.indexOf("Needs Your Review"),
  );
  assert.equal(source.match(/Active Newsletter Series/g)?.length, 1);
});

test("project actions remain sticky and social images use thumbnails", () => {
  const projects = read("app/admin/projects/ProjectListManager.tsx");
  const media = read(
    "app/admin/projects/[projectId]/ProjectMediaManager.tsx",
  );
  assert.match(projects, /sticky right-0/);
  assert.match(projects, />Actions</);
  assert.match(media, /Share-image utilities/);
  assert.match(media, /aria-pressed=\{socialImageMediaId === item\.id\}/);
  assert.match(media, /<Image src=\{item\.publicUrl!\}/);
  assert.ok(
    media.indexOf("Restore Automatic Preview") <
      media.indexOf("aria-pressed={socialImageMediaId === item.id}"),
  );
});

test("Referral delivery behavior remains outside the interface rollout", () => {
  const changedSurface = [
    "app/admin/homepage/page.tsx",
    "app/admin/homepage/HomepageStructureManager.tsx",
    "app/admin/about/AboutPageManager.tsx",
    "app/admin/newsletter-studio/components/NewsletterDashboard.tsx",
    "app/admin/projects/ProjectListManager.tsx",
    "app/admin/projects/[projectId]/page.tsx",
    "app/admin/projects/[projectId]/ProjectMediaManager.tsx",
  ]
    .map(read)
    .join("\n");
  assert.doesNotMatch(
    changedSurface,
    /referral\/cron|send-referral|retry-safe|CRON_SECRET|providerMessageId/,
  );
});
