// Real React component, synthetic fetch only. Never mounts in the application.
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

const bundle = await build({
  entryPoints: ["scripts/browser/location-editor-fixture.jsx"], bundle: true, jsx: "automatic", write: false,
  plugins: [{ name: "synthetic-next-presentation", setup(builder) {
    builder.onResolve({ filter: /^next\/(link|image)$/ }, args => ({ path: args.path, namespace: "synthetic-next" }));
    builder.onLoad({ filter: /.*/, namespace: "synthetic-next" }, args => ({ loader: "jsx", resolveDir: process.cwd(), contents: args.path === "next/link"
      ? 'export default function Link({prefetch, ...props}) { return <a {...props} />; }'
      : 'export default function Image({fill, priority, ...props}) { return <img {...props} />; }' }));
  } }],
});
const css = await postcss([tailwind()]).process(await readFile("app/globals.css", "utf8"), { from: "app/globals.css" });
if (process.argv.includes("--bundle-only")) {
  console.log("PASS: location editor fixture bundled; no browser verification performed");
} else {
  const files = {
    "/": ["text/html", '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic location editor</title><link rel="stylesheet" href="/style.css"></head><body style="background:#090909;color:white;padding:16px;max-width:1000px;margin:auto"><main id="root"></main><script src="/fixture.js"></script></body></html>'],
    "/fixture.js": ["text/javascript", bundle.outputFiles[0].contents],
    "/style.css": ["text/css", css.css],
    "/synthetic-image": ["image/png", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9AAAAABJRU5ErkJggg==", "base64")],
  };
  const server = createServer((request, response) => {
    const file = files[request.url];
    if (!file || request.method !== "GET") { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "Content-Type": file[0], "Cache-Control": "no-store" }); response.end(file[1]);
  });
  try {
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const { checkLocationEditor } = await import("./location-editor-check.mjs");
    await checkLocationEditor(`http://127.0.0.1:${server.address().port}`);
  } finally { await new Promise(resolve => server.close(resolve)); }
}
