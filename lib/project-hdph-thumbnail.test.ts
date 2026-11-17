import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const route = readFileSync(new URL("../app/api/admin/projects/hdph-import/thumbnail/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/admin/projects/HDPhotoHubImport.tsx", import.meta.url), "utf8");
test("thumbnail route is authenticated, bounded and read-only", () => {
  for (const guard of ['getAdminSession()', 'session.role', 'projectHdphReader(session.workspaceId).photo', 'hdphSafeImageUrl', 'redirect: "error"', '8 * 1024 * 1024', 'reader.cancel()', 'private, no-store', 'limitInputPixels']) assert.ok(route.includes(guard), guard);
  assert.doesNotMatch(route, /PutObjectCommand|prisma\.|export async function POST/);
});
test("thumbnail grid retains accessible individual selection and selected state", () => {
  for (const feature of ['type="checkbox"', 'Already imported:', 'checked={selected || !!photo.alreadyImported}', 'loading="lazy"', 'bg-emerald-500', 'Select all new photos', 'Clear selection', 'Preview unavailable', 'Photos available to import']) assert.ok(ui.includes(feature), feature);
});
