import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";

const scratch = await mkdtemp(join(tmpdir(), "helios-recovery-browser-"));
const bundle = await build({ entryPoints: ["scripts/browser/generation-recovery-fixture.jsx"], bundle: true, jsx: "automatic", write: false });
const css = await postcss([tailwind()]).process(await readFile("app/globals.css", "utf8"), { from: "app/globals.css" });
const files = {
  "/": ["text/html", '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic generation recovery check</title><link rel="stylesheet" href="/style.css"></head><body style="background:#090909;color:white;padding:24px;max-width:1000px;margin:auto"><div id="root"></div><script src="/fixture.js"></script></body></html>'],
  "/fixture.js": ["text/javascript", bundle.outputFiles[0].contents],
  "/style.css": ["text/css", css.css],
};
const server = createServer((request, response) => {
  const file = files[request.url];
  if (!file || request.method !== "GET") { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { "Content-Type": file[0], "Cache-Control": "no-store" }); response.end(file[1]);
});
try {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  process.env.RECOVERY_FIXTURE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.RECOVERY_SCREENSHOT = join(scratch, "mobile-confirmation.png");
  await import("./generation-recovery-check.mjs");
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(scratch, { recursive: true, force: true });
}
