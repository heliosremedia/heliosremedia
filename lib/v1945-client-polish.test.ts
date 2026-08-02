import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("V1.9.4.5 does not reintroduce global route transitions", () => {
  const layout = read("app/layout.tsx");
  assert.doesNotMatch(layout, /PublicRouteTransition|navigation-start|transition overlay/i);
});

test("share control stays compact with a 44 pixel target and visible focus", () => {
  const source = read("app/portfolio/[slug]/ShareProject.tsx");
  assert.match(source, /min-h-11/);
  assert.match(source, /px-3\.5/);
  assert.match(source, /focus-visible:outline/);
});

test("team biographies clamp responsively and expose accessible controls only on overflow", () => {
  const source = read("app/about/TeamBiography.tsx");
  assert.match(source, /line-clamp-5 sm:line-clamp-6/);
  assert.match(source, /scrollHeight > content\.clientHeight/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /aria-controls=\{contentId\}/);
  assert.match(source, /overflowing \|\| expanded/);
});

test("FAQ, Services, and Blog polish remains data-driven", () => {
  const faq = read("app/faq/FaqExplorer.tsx");
  assert.match(faq, /categories\.map/);
  assert.match(faq, /min-h-11/);
  assert.match(faq, /flex-wrap/);
  assert.doesNotMatch(faq, /overflow-x-auto/);
  assert.match(read("app/services/page.tsx"), /className="mt-5 max-w-xl[\s\S]*service\.description/);
  assert.match(read("app/blog/page.tsx"), /post\.excerpt[\s\S]*mobile-summary mt-3/);
});

test("project metadata uses the selected image through the existing optimizer", () => {
  const page = read("app/portfolio/[slug]/page.tsx");
  assert.match(page, /optimizeProjectSocialImage/);
  assert.match(page, /resolveProjectSocialImage/);
  assert.match(page, /secureUrl: image\.url/);
});
