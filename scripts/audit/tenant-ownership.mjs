import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
const declarations = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
const names = new Set(declarations.map(match => match[1]));
function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (["generated", "node_modules"].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(tsx?|mjs)$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}
const sources = ["app", "lib", "scripts"].flatMap(name => sourceFiles(resolve(root, name)))
  .filter(path => path !== fileURLToPath(import.meta.url))
  .map(path => ({ path: relative(root, path), text: readFileSync(path, "utf8") }));
const models = declarations.map(([, name, body]) => {
  const fieldLines = body.split("\n").map(line => line.trim()).filter(line => /^[a-zA-Z]\w*\s+/.test(line));
  const workspace = fieldLines.find(line => /^workspaceId\s/.test(line));
  const foreignKeys = fieldLines.flatMap(line => {
    const field = line.match(/^(\w+)\s+(\w+)(\??)\s+.*@relation\(.*fields:\s*\[([^\]]+)\].*references:\s*\[([^\]]+)\]/);
    if (!field || !names.has(field[2])) return [];
    return [{ relation: field[1], model: field[2], optional: field[3] === "?", fields: field[4].split(",").map(s => s.trim()), references: field[5].split(",").map(s => s.trim()), onDelete: line.match(/onDelete:\s*(\w+)/)?.[1] ?? "Prisma default" }];
  });
  const delegate = name[0].toLowerCase() + name.slice(1);
  const references = sources.filter(source => new RegExp(`\\b(?:prisma|tx|transaction)\\.${delegate}\\.`).test(source.text)).map(source => source.path);
  return {
    model: name,
    workspaceField: !workspace ? "absent" : /\bString\?/.test(workspace) ? "nullable" : "required",
    foreignKeys,
    uniqueConstraints: [...fieldLines.filter(line => /@unique\b/.test(line)).map(line => line.split(/\s/)[0]), ...[...body.matchAll(/@@unique\(\[([^\]]+)\]/g)].map(match => match[1])],
    sourceReferences: references,
    reviewStatus: "Requires semantic ownership and execution-path review",
  };
});
const config = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"));
const routes = sources.filter(source => source.path.startsWith("app/") && /\/route\.ts$/.test(source.path))
  .map(source => ({ path: source.path, methods: [...source.text.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS)\b/g)].map(match => match[1]), reviewStatus: "Unverified by this inventory" }));
const result = {
  schemaSha256: createHash("sha256").update(schema).digest("hex"),
  scope: "Static code inventory, not an authorization or tenant-isolation verdict. No database connection or environment values read.",
  limitations: ["Nullable ownership requires verified mapping before activation.", "Foreign-key presence does not prove same-workspace relationships.", "Creator/account relations are not immutable content ownership.", "Delegate references are lexical; aliases, wrappers, dynamic access and raw SQL require manual review.", "Caches, storage objects, integration configuration, running jobs and hosted behavior require separate evidence."],
  counts: { models: models.length, requiredWorkspace: models.filter(model => model.workspaceField === "required").length, nullableWorkspace: models.filter(model => model.workspaceField === "nullable").length, withoutWorkspace: models.filter(model => model.workspaceField === "absent").length, routeFiles: routes.length },
  models,
  routes,
  serverActionFiles: sources.filter(source => /["']use server["']/.test(source.text)).map(source => source.path),
  scheduledRoutes: config.crons ?? [],
};
writeFileSync(resolve(root, "docs/helios-studio-v2-ownership-inventory.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result.counts));
