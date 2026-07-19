import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.VERCEL_ENV === "production") {
  console.log("Applying production database migrations…");
  run("npx", ["prisma", "migrate", "deploy"]);
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
