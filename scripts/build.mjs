import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Only the explicit staging path may enter authenticated hosted admission.
if (process.env.STAGING_HOSTED_ADMISSION === "preview-only") {
  run(process.execPath, ["--input-type=module", "-e", "import('./scripts/staging/hosted-build.mjs').then(m => m.main())"]);
  process.exit(0);
}
// Every other hosted context remains closed.
// A plain local build is not a deployable release artifact. Use the isolated release workflow.
if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.HELIOS_RELEASE_TARGET) {
  console.log("Release blocked: use the classified isolated release workflow. Hosted release remains on hold.");
  process.exit(1);
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
