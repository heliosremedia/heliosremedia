import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../scripts/build.mjs", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function runBuild(environment: string, status: number | null = 0) {
  const calls: string[][] = [];
  let exitCode: number | undefined;
  const exitSignal = new Error("STOP");
  try {
    runInNewContext(source, {
      exports: {}, console: { log() {} },
      process: { env: { VERCEL_ENV: environment }, platform: "linux", exit(code: number) { exitCode = code; throw exitSignal; } },
      require(name: string) {
        assert.equal(name, "node:child_process");
        return { spawnSync(command: string, args: string[]) {
          calls.push([command, ...args]);
          return { status: args.includes("status") ? status : 0 };
        } };
      },
    });
  } catch (error) { if (error !== exitSignal) throw error; }
  return { calls, exitCode };
}
test("production checks history but never applies migrations during a build", () => {
  const result = runBuild("production");
  assert.deepEqual(result.calls, [["npx","prisma","migrate","status"],["npx","prisma","generate"],["npx","next","build"]]);
  assert.equal(result.exitCode, undefined);
});
test("failed migration status stops generation and application build", () => {
  for (const status of [1, 2, null]) {
    const result = runBuild("production", status);
    assert.equal(result.calls.length, 1);
    assert.equal(result.exitCode, status ?? 1);
  }
});
test("preview and local builds have no database migration command", () => {
  for (const environment of ["preview", "development", ""]) {
    assert.deepEqual(runBuild(environment).calls, [["npx","prisma","generate"],["npx","next","build"]]);
  }
});
