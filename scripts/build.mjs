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
  console.log("Checking production migration history. Apply reviewed migrations separately before deployment.");
  run("npx", ["prisma", "migrate", "status"]);
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
