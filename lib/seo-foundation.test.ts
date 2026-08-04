import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getCanonicalAbsoluteUrl,
  getVerifiedSocialProfiles,
} from "./site.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("canonical URLs use the configured tenant origin and discard tracking queries", () => {
  assert.equal(
    getCanonicalAbsoluteUrl("/portfolio/example", "https://www.heliosrealestatemedia.com/ignored"),
    "https://www.heliosrealestatemedia.com/portfolio/example",
  );
});

test("structured data excludes Facebook search and invalid profile URLs", () => {
  assert.deepEqual(
    getVerifiedSocialProfiles([
      "https://www.facebook.com/search/top?q=helios",
      "javascript:alert(1)",
      "https://www.instagram.com/heliosremedia/",
    ]),
    ["https://www.instagram.com/heliosremedia/"],
  );
});

test("robots has no Host directive and uses the configured canonical sitemap", () => {
  const robots = read("app/robots.ts");
  assert.doesNotMatch(robots, /\bhost\s*:/);
  assert.match(robots, /getCanonicalAbsoluteUrl\("\/sitemap\.xml", settings\.websiteUrl\)/);
  assert.match(robots, /disallow: "\/"/);
});

test("legacy hosts redirect path-for-path to the canonical public origin", () => {
  const config = read("next.config.ts");
  assert.match(config, /LEGACY_PUBLIC_HOSTS/);
  assert.match(config, /source: "\/:path\*"/);
  assert.match(config, /destination: `\$\{canonicalPublicUrl\}\/\:path\*`/);
  assert.match(config, /permanent: true/);
});

test("active application source contains no former-domain production defaults", () => {
  for (const file of [".env.example", "app/api/admin/newsletters/images/route.ts"]) {
    assert.doesNotMatch(read(file), /https:\/\/www\.heliosremedia\.com/);
  }
});

test("public service-card alt fallbacks do not expose filenames", () => {
  for (const file of ["app/services/page.tsx", "app/services/[slug]/page.tsx"]) {
    const source = read(file);
    const imageAltExpressions = source.match(/alt=\{[\s\S]{0,260}?\}/g) || [];
    assert.ok(imageAltExpressions.every((expression) => !expression.includes("originalFilename")));
  }
});
