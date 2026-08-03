import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Project Editor exposes five mounted accessible collapsible sections", () => {
  const page = read("../app/admin/projects/[projectId]/page.tsx");
  const workflow = read("../app/admin/projects/[projectId]/ProjectWorkflowManager.tsx");
  const section = read("../app/admin/projects/[projectId]/ProjectEditorSection.tsx");
  const navigator = read("../app/admin/components/AdminSectionNavigator.tsx");

  for (const id of ["project-identity", "project-credits", "project-media", "project-services", "project-publishing"]) {
    assert.match(`${page}\n${workflow}`, new RegExp(`ProjectEditorSection id=\\"${id}\\"`));
  }
  assert.match(section, /useState\(false\)/);
  assert.match(section, /hidden=!\{?expanded\}?|hidden=\{!expanded\}/);
  assert.match(section, /aria-expanded=\{expanded\}/);
  assert.match(section, /aria-label=\{`\$\{expanded \? "Collapse" : "Expand"\} \$\{title\}`\}/);
  assert.match(section, /onInvalidCapture/);
  assert.match(navigator, /All sections \$\{expanded \? "expanded" : "collapsed"\}/);
  assert.match(navigator, /aria-live="polite"/);
  assert.match(page, /projectEditor/);
});
