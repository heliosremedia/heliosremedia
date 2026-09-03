import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Newsletter Studio exposes a protected direct image upload", () => {
  const panel = read("app/admin/newsletter-studio/components/ImageSourcePanel.tsx");
  const presign = read("app/api/admin/newsletters/images/presign/route.ts");
  const storage = read("lib/r2-upload.ts");

  assert.match(panel, /"Upload image"/);
  assert.match(panel, /accept="image\/jpeg,image\/png,image\/webp,image\/avif"/);
  assert.match(panel, /\/api\/admin\/newsletters\/images\/presign/);
  assert.match(panel, /method: "PUT"/);
  assert.match(panel, /mode: "CUSTOM", sourceLabel: "Uploaded by administrator"/);
  assert.match(presign, /requireNewsletterAdministrator\(\)/);
  assert.match(presign, /validateImageUpload\(file\)/);
  assert.match(storage, /email\/newsletters\/\$\{safeWorkspace\}/);
});

test("uploaded images reuse the existing newsletter image state", () => {
  const panel = read("app/admin/newsletter-studio/components/ImageSourcePanel.tsx");
  assert.match(panel, /imageUrl: data\.upload\.publicUrl/);
  assert.match(panel, /altText: block\.altText\?\.trim\(\) \|\| fallbackAlt/);
  assert.doesNotMatch(panel, /uploadedImageUrl/);
});
