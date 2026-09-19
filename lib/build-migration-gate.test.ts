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
test("hosted builds stop before any database or build command without release admission", () => {
 for(const environment of ["production","preview","development"]){
  for(const status of [0,1,2,null]){
   const result=runBuild(environment,status);assert.equal(result.exitCode,1);assert.deepEqual(result.calls,[]);
  }
 }
});
test("plain local build has no migration command and is not a release artifact", () => {
 assert.deepEqual(runBuild("").calls,[["npx","prisma","generate"],["npx","next","build"]]);
});
