import assert from "node:assert/strict";
import test from "node:test";
import { brandAssetPrefix, resolveBrandImage, brandImageCleanupPending } from "./workspace-brand-storage.ts";

const url = (key: string) => `https://assets.example/${key}`;
for (const kind of ["testimonials", "trusted-logos", "blog", "newsletter-ai"] as const) {
  test(`${kind}: workspace ownership and canonical URL`, () => {
    const key = `${brandAssetPrefix("company-a", kind)}upload-123.webp`;
    assert.deepEqual(resolveBrandImage("company-a", kind, { key, url: "https://foreign.example/photo" }, null, url), { key, url: url(key) });
    for (const bad of [key.replace("company-a", "company-b"), key.replace("company-a/", "company-a-extra/"), key.replace("upload-123", "../escape"), key.replace("upload-123", "%2e%2e%2fescape"), `${kind}/legacy.webp`]) {
      assert.throws(() => resolveBrandImage("company-a", kind, { key: bad, url: url(bad) }, null, url), /INVALID_BRAND_IMAGE/);
    }
    assert.throws(() => resolveBrandImage("company-a", kind, { key: null, url: url(key) }, null, url), /INVALID_BRAND_IMAGE/);
  });
  test(`${kind}: legacy preservation only on its current record`, () => {
    const existing = { key: `${kind}/legacy.webp`, url: "https://assets.example/legacy.webp" };
    assert.deepEqual(resolveBrandImage("company-a", kind, existing, existing, url), existing);
    assert.throws(() => resolveBrandImage("company-a", kind, { ...existing, url: "https://foreign.example/photo" }, existing, url), /INVALID_BRAND_IMAGE/);
    const foreign = { key: `workspaces/company-b/${kind}/image.webp`, url: "https://assets.example/image.webp" };
    assert.throws(() => resolveBrandImage("company-a", kind, foreign, foreign, url), /INVALID_BRAND_IMAGE/);
    assert.deepEqual(resolveBrandImage("company-a", kind, { key: null, url: null }, existing, url), { key: null, url: null });
    assert.equal(brandImageCleanupPending(existing.key), true);
    assert.equal(brandImageCleanupPending(null), false);
  });
}
test("invalid workspace identifiers cannot collide through normalization", () => {
  for (const id of ["", "a/b", "a b", "..", "a%2fb"]) assert.throws(() => brandAssetPrefix(id, "testimonials"));
  assert.notEqual(brandAssetPrefix("a-b", "testimonials"), brandAssetPrefix("ab", "testimonials"));
});
