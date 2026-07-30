import { createHash, timingSafeEqual } from "node:crypto";
import { contentHash } from "./content-hash.ts";

type NewsletterSnapshot = {
  subject: string;
  previewText: string | null;
  blocks: Array<Record<string, unknown>>;
};

const EDITOR_BLOCK_KEYS = [
  "type",
  "internalLabel",
  "eyebrow",
  "heading",
  "body",
  "imageUrl",
  "altText",
  "imageLink",
  "imageIsVideo",
  "imageSelection",
  "imageCandidates",
  "link",
  "buttonLabel",
  "alignment",
  "imageAlt",
  "linkUrl",
  "sourceIds",
] as const;

const IMAGE_SELECTION_KEYS = [
  "mode",
  "candidateId",
  "assetId",
  "assetSource",
  "sourceLabel",
  "attribution",
] as const;

const IMAGE_CANDIDATE_KEYS = [
  "id",
  "url",
  "thumbnailUrl",
  "altText",
  "label",
  "role",
  "destinationUrl",
  "isVideo",
  "width",
  "height",
] as const;

function orderedObject(
  value: Record<string, unknown>,
  keys: readonly string[],
) {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.hasOwn(value, key) && value[key] !== undefined) {
      result[key] = value[key];
    }
  }
  return result;
}

function editorOrderedBlock(block: Record<string, unknown>) {
  const ordered = orderedObject(block, EDITOR_BLOCK_KEYS);
  if (ordered.imageSelection && typeof ordered.imageSelection === "object") {
    ordered.imageSelection = orderedObject(
      ordered.imageSelection as Record<string, unknown>,
      IMAGE_SELECTION_KEYS,
    );
  }
  if (Array.isArray(ordered.imageCandidates)) {
    ordered.imageCandidates = ordered.imageCandidates.map((candidate) =>
      candidate && typeof candidate === "object" && !Array.isArray(candidate)
        ? orderedObject(candidate as Record<string, unknown>, IMAGE_CANDIDATE_KEYS)
        : candidate);
  }
  return ordered;
}

function legacyHash(snapshot: NewsletterSnapshot) {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

function equalHash(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export type NewsletterIntegrityResult = {
  valid: boolean;
  format: "CANONICAL" | "LEGACY_EDITOR" | "LEGACY_JSON" | "INVALID";
  canonicalHash: string;
};

export function verifyNewsletterRevisionIntegrity(
  snapshot: NewsletterSnapshot,
  storedHash: string,
): NewsletterIntegrityResult {
  const canonicalHash = contentHash(snapshot);
  if (equalHash(canonicalHash, storedHash)) {
    return { valid: true, format: "CANONICAL", canonicalHash };
  }

  // Newsletter revisions created before V1.9.0.2 were hashed before their
  // snapshots entered PostgreSQL jsonb. jsonb preserves values but not object
  // key order, so reconstruct the two historical serializers exactly.
  const previewVariants = snapshot.previewText === null
    ? [null, ""] as const
    : [snapshot.previewText] as const;
  for (const previewText of previewVariants) {
    const editorHash = legacyHash({
      subject: snapshot.subject,
      previewText,
      blocks: snapshot.blocks.map(editorOrderedBlock),
    });
    if (equalHash(editorHash, storedHash)) {
      return { valid: true, format: "LEGACY_EDITOR", canonicalHash };
    }
    const jsonHash = legacyHash({ ...snapshot, previewText });
    if (equalHash(jsonHash, storedHash)) {
      return { valid: true, format: "LEGACY_JSON", canonicalHash };
    }
  }
  return { valid: false, format: "INVALID", canonicalHash };
}
