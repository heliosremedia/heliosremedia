import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("admin media cards fall back to resolved external video posters", () => {
  const source = readFileSync(
    new URL("../app/admin/media/MediaLibraryGrid.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const cardImageUrl = item\.publicUrl \|\| externalMedia\?\.thumbnailUrl/,
  );
  assert.match(source, /<Image[\s\S]*?src=\{cardImageUrl\}/);
});
