CREATE TYPE "LegalDocumentType" AS ENUM ('PRIVACY_POLICY', 'TERMS_OF_SERVICE');

ALTER TABLE "SiteSettings"
  ADD COLUMN "privacyPolicyPublished" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "termsOfServicePublished" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "LegalDocument" (
  "id" TEXT NOT NULL,
  "type" "LegalDocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalDocument_type_key" ON "LegalDocument"("type");
CREATE INDEX "LegalDocument_published_idx" ON "LegalDocument"("published");

INSERT INTO "LegalDocument" ("id", "type", "title", "content", "published", "updatedAt")
VALUES
  ('legal-privacy-policy', 'PRIVACY_POLICY', 'Privacy Policy', '', false, CURRENT_TIMESTAMP),
  ('legal-terms-of-service', 'TERMS_OF_SERVICE', 'Terms of Service', '', false, CURRENT_TIMESTAMP)
ON CONFLICT ("type") DO NOTHING;
