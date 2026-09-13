import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("portfolio filters require visible media assigned to the selected service", () => {
  const source = read("app/(public)/portfolio/page.tsx");
  assert.match(source, /media:\s*\{\s*some:\s*\{\s*serviceId: selectedService\.id,\s*visibility: "VISIBLE"/s);
  assert.doesNotMatch(source, /mediaCategory:\s*\{\s*in: selectedMediaCategories/);
});

test("public utility pages use complete page-specific metadata", () => {
  for (const path of ["app/(public)/blog/page.tsx", "app/(public)/book/page.tsx", "app/(public)/client-portal/page.tsx", "app/(public)/privacy/page.tsx", "app/(public)/terms/page.tsx"]) {
    assert.match(read(path), /buildPageMetadata/);
  }
  assert.match(read("app/(public)/client-portal/page.tsx"), /path: "\/client-portal"[\s\S]*noIndex: true/);
});

test("public cleanup removes stale labels and preserves honeypot accessibility", () => {
  assert.doesNotMatch(read("app/(public)/services/page.tsx"), /Matterport/);
  assert.doesNotMatch(read("app/(public)/services/page.tsx"), /Math\.random/);
  assert.doesNotMatch(read("app/(public)/portfolio/[slug]/PortfolioGallery.tsx"), />\s*Original\s*</);
  const contact = read("app/(public)/contact/ContactForm.tsx");
  assert.match(contact, /name="website" tabIndex=\{-1\}/);
  assert.match(contact, /aria-hidden="true"/);
});

test("embedded legal document headings cannot create a second page h1", () => {
  assert.match(read("lib/legal-html.ts"), /h1:[\s\S]*tagName: "h2"/);
});
