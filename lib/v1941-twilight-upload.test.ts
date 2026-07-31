import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getProjectMediaImageValidationError,
  PROJECT_MEDIA_MAX_IMAGE_UPLOAD_BYTES,
  PROJECT_MEDIA_MAX_IMAGE_UPLOAD_MIB,
} from "./project-media-upload.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("project image uploads use one binary 50 MiB boundary", () => {
  assert.equal(PROJECT_MEDIA_MAX_IMAGE_UPLOAD_MIB, 50);
  assert.equal(PROJECT_MEDIA_MAX_IMAGE_UPLOAD_BYTES, 52_428_800);
  assert.equal(getProjectMediaImageValidationError({ type: "image/jpeg", size: 32.6 * 1024 * 1024 }), null);
  assert.equal(getProjectMediaImageValidationError({ type: "image/jpeg", size: PROJECT_MEDIA_MAX_IMAGE_UPLOAD_BYTES }), null);
  assert.match(
    getProjectMediaImageValidationError({ type: "image/jpeg", size: PROJECT_MEDIA_MAX_IMAGE_UPLOAD_BYTES + 1 }) ?? "",
    /Image exceeds the 50 MB upload limit \(actual size: 50\.0 MB, 52,428,801 bytes\)/,
  );
});

test("unsupported project images fail independently before upload", () => {
  assert.match(getProjectMediaImageValidationError({ type: "image/gif", size: 1024 }) ?? "", /Only JPG/);
  assert.equal(getProjectMediaImageValidationError({ type: "image/png", size: 25 * 1024 * 1024 }), null);
});

test("Twilight queue identity and retry remain service based", () => {
  const uploader = read("app/admin/projects/[projectId]/MediaUploader.tsx");
  const presign = read("app/api/admin/r2/presign/route.ts");
  const mediaRoute = read("app/api/admin/projects/[projectId]/media/route.ts");
  assert.match(uploader, /serviceId: selectedServiceId/);
  assert.match(uploader, /serviceName: selectedService\.name/);
  assert.match(uploader, /upload\.serviceName/);
  assert.match(uploader, /presignData\.upload\.serviceId !== upload\.serviceId/);
  assert.doesNotMatch(uploader, /getMediaCollection\(\s*upload\.mediaCategory/);
  assert.match(presign, /getProjectMediaImageValidationError/);
  assert.match(mediaRoute, /uploadedObject\.ContentLength/);
  assert.match(mediaRoute, /serviceId: selectedService\.id/);
  assert.match(mediaRoute, /projectService\.createMany[\s\S]*skipDuplicates: true/);
});

test("V1.9.4.1 release starts DEPLOYING with accurate notes", () => {
  const version = read("lib/version.ts");
  const releases = read("lib/releases.ts");
  assert.match(version, /STUDIO_VERSION = "V1\.9\.4\.1"/);
  assert.match(version, /v1-9-4-1/);
  assert.ok(releases.indexOf('version: "V1.9.4.1"') < releases.indexOf('version: "V1.9.4"'));
  assert.match(releases, /title: "Twilight Photography Upload Correction"/);
  assert.match(releases, /version: "V1\.9\.4\.1"[\s\S]*releaseDate: null[\s\S]*status: "DEPLOYING"/);
});
