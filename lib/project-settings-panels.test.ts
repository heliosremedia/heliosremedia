import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Projects settings stay independently collapsed with mounted editors", () => {
  const panel = read("../app/admin/projects/ProjectSettingsPanel.tsx");
  assert.match(panel, /<details className=/);
  assert.doesNotMatch(panel, /<details[^>]*\b(?:open|name)=/);
  assert.match(panel, /<summary /);
  assert.match(panel, /\{children\}<\/div>/);
  assert.match(panel, /Unsaved changes/);
  assert.match(panel, /role="status"/);
  assert.match(panel, /focus-visible:outline/);
});

test("Each editor tracks its saved snapshot and retains its explicit save control", () => {
  const featured = read("../app/admin/projects/FeaturedProjectsManager.tsx");
  const discovery = read("../app/admin/projects/PortfolioDiscoverySettingsManager.tsx");
  assert.match(featured, /<ProjectSettingsPanel title="Featured Projects"/);
  assert.match(featured, /setSavedIds\(JSON.stringify\(selected.map/);
  assert.match(featured, /Save Featured Projects/);
  assert.match(featured, /warning=\{overLimitCount > 6 && !limitResolved/);
  assert.match(discovery, /<ProjectSettingsPanel title="Portfolio Discovery"/);
  assert.match(discovery, /setSavedSettings\(JSON.stringify\(settings\)\)/);
  assert.match(discovery, /Save Gallery Settings/);
  for (const source of [featured, discovery]) {
    assert.ok(source.indexOf("if (!response.ok") < source.indexOf("setSaved", source.indexOf("async function save")));
  }
});

test("Featured stays first within Organization and project search/filter controls remain accessible", () => {
  const page = read("../app/admin/projects/page.tsx");
  assert.ok(page.indexOf("<FeaturedProjectsManager") < page.indexOf("<PortfolioDiscoverySettingsManager"));
  assert.ok(page.indexOf("<ProjectListManager") < page.indexOf('label: "Portfolio Organization"'));
  assert.match(page, /aria-label="Search projects by title, location, or property address"/);
  assert.match(page, /aria-current=\{activeStatus === option.value/);
});

test("Featured Remove stays visually compact despite the global button font reset", () => {
  const featured = read("../app/admin/projects/FeaturedProjectsManager.tsx");
  assert.match(featured, /fontSize: "0.625rem", lineHeight: "1rem"/);
  assert.match(featured, /min-h-11 min-w-11 shrink-0/);
  assert.match(featured, /Remove \$\{project.title\} from featured projects/);
});
