CREATE TABLE "NewsletterImageAsset" (
  "id" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "altText" TEXT NOT NULL,
  "attribution" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "quality" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NewsletterImageAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsletterImageAsset_storageKey_key" ON "NewsletterImageAsset"("storageKey");
CREATE INDEX "NewsletterImageAsset_createdAt_idx" ON "NewsletterImageAsset"("createdAt");
CREATE INDEX "NewsletterImageAsset_createdById_idx" ON "NewsletterImageAsset"("createdById");

ALTER TABLE "NewsletterImageAsset"
  ADD CONSTRAINT "NewsletterImageAsset_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
