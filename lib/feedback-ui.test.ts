import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("FeedbackWorkspace actual React server render keeps drafts inactive and response claims honest", () => {
  const repo = fileURLToPath(new URL("..", import.meta.url));
  const output = execFileSync(process.execPath, ["scripts/verify-feedback-render.mjs"], {
    cwd: repo,
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.match(output, /PASS: actual FeedbackWorkspace React SSR/);
});
