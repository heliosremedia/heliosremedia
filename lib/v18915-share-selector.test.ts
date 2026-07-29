import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL(
    "../app/admin/projects/[projectId]/ProjectMediaManager.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("share-image selector is collapsed by default with current context", () => {
  assert.match(
    source,
    /useState\(false\);\n  const socialImageSelectorButtonRef/,
  );
  assert.match(source, /aria-expanded=\{isSocialImageSelectorOpen\}/);
  assert.match(source, /aria-controls="project-social-image-choices"/);
  assert.match(source, /Choose a Different Share Image/);
  assert.match(source, /\{socialImageChoices\.length\} available/);
  assert.match(source, /isSocialImageSelectorOpen \? \(/);
});

test("expanded choices use a compact responsive lazy-loaded grid", () => {
  assert.match(
    source,
    /grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8/,
  );
  assert.match(source, /loading="lazy"/);
  assert.match(source, /sizes="\(max-width: 640px\) 46vw, 160px"/);
  assert.match(source, /truncate text-\[0\.65rem\]/);
  assert.match(source, /title=\{item\.originalFilename \|\| undefined\}/);
});

test("successful selection collapses and returns focus while failure stays open", () => {
  const handler = source.slice(
    source.indexOf("const handleSetSocialImage"),
    source.indexOf("  useEffect(() =>", source.indexOf("const handleSetSocialImage")),
  );
  assert.match(handler, /if \(mediaId\) \{/);
  assert.match(handler, /setIsSocialImageSelectorOpen\(false\)/);
  assert.match(
    handler,
    /requestAnimationFrame\(\(\) => socialImageSelectorButtonRef\.current\?\.focus\(\)\)/,
  );
  assert.ok(
    handler.indexOf("setIsSocialImageSelectorOpen(false)") <
      handler.indexOf("} catch (updateError)"),
  );
  assert.doesNotMatch(
    handler.slice(handler.indexOf("} catch (updateError)")),
    /setIsSocialImageSelectorOpen\(false\)/,
  );
});

test("utility control remains separate and persistence contract is unchanged", () => {
  assert.ok(
    source.indexOf("Share-image utilities") <
      source.indexOf('id="project-social-image-choices"'),
  );
  assert.match(source, /Restore Automatic Preview/);
  assert.match(
    source,
    /body: JSON\.stringify\(\{ action: "set-social-image", mediaId \}\)/,
  );
  assert.match(source, /aria-pressed=\{socialImageMediaId === item\.id\}/);
});
