import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Hosted admission is deliberately closed until an explicitly reviewed hosted adapter exists.
// A plain local build is not a deployable release artifact. Use the isolated release workflow.
if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.HELIOS_RELEASE_TARGET) {
  console.log("Release blocked: use the classified isolated release workflow. Hosted release remains on hold.");
  process.exit(1);
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
