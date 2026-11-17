import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("Studio semantic foundation compiles and shared controls preserve loading semantics", () => {
  const output = execFileSync(process.execPath, ["scripts/verify-studio-standard.mjs"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", timeout: 30_000,
  });
  assert.match(output, /PASS: real AdminButton SSR/);
});
