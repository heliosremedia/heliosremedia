import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BRANDED_VIDEO_POSTER_URL,
  resolveExternalMedia,
} from "./external-media.ts";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Cloudflare Stream posters derive from the stable video identifier", () => {
  const uid = "a163d0f679d3e1349d4817b9ebf2223f";
  const media = resolveExternalMedia(`https://iframe.videodelivery.net/${uid}`);

  assert.equal(media.externalId, uid);
  assert.equal(media.embedUrl, `https://iframe.videodelivery.net/${uid}`);
  assert.equal(
    media.thumbnailUrl,
    `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?time=2.5s&fit=crop`,
  );
});

test("providers without a stable poster use the branded video fallback", () => {
  assert.equal(
    resolveExternalMedia("https://vimeo.com/123456789").thumbnailUrl,
    BRANDED_VIDEO_POSTER_URL,
  );
  assert.equal(
    resolveExternalMedia("https://cdn.example.com/film.mp4").thumbnailUrl,
    BRANDED_VIDEO_POSTER_URL,
  );
});

test("the image optimizer permits only the shared video-poster paths", () => {
  const config = read("next.config.ts");

  assert.match(config, /hostname: "videodelivery\.net"/);
  assert.match(config, /pathname: "\/\*\*\/thumbnails\/\*\*"/);
  assert.match(config, /hostname: "i\.ytimg\.com"/);
  assert.match(config, /pathname: "\/vi\/\*\*"/);
});

test("the cinematic film library routes thumbnails through the shared optimizer", () => {
  const library = read("app/portfolio/PortfolioFilmLibrary.tsx");

  assert.match(library, /import Image from "next\/image"/);
  assert.match(library, /<Image[\s\S]*src=\{media\.thumbnailUrl\}/);
  assert.doesNotMatch(library, /<img[\s\S]*src=\{media\.thumbnailUrl\}/);
});

test("admin project thumbnails route through the shared optimizer", () => {
  const projectList = read("app/admin/projects/ProjectListManager.tsx");
  const mediaManager = read(
    "app/admin/projects/[projectId]/ProjectMediaManager.tsx",
  );

  assert.match(projectList, /import Image from "next\/image"/);
  assert.match(projectList, /<Image[\s\S]*src=\{project\.thumbnailUrl\}/);
  assert.doesNotMatch(projectList, /<img[\s\S]*src=\{project\.thumbnailUrl\}/);

  assert.match(mediaManager, /import Image from "next\/image"/);
  assert.match(
    mediaManager,
    /<Image[\s\S]*src=\{externalMedia\.thumbnailUrl\}/,
  );
  assert.doesNotMatch(
    mediaManager,
    /<img[\s\S]*src=\{externalMedia\.thumbnailUrl\}/,
  );
});
