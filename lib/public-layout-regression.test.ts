import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("solid-navigation public heroes do not add a duplicate outer offset", () => {
  const blog = readFileSync("app/blog/page.tsx", "utf8");
  assert.match(blog, /<Navbar variant="solid" \/>/);
  assert.match(blog, /<section className="relative overflow-hidden border-b border-white\/\[0\.08\]">/);
  assert.match(blog, /container-shell relative py-14 sm:py-16 lg:py-20/);
  assert.match(blog, /mobile-summary mt-20/);
});
