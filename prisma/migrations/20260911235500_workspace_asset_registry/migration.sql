CREATE TYPE "WorkspaceAssetProvider" AS ENUM ('R2', 'CLOUDFLARE_STREAM');
CREATE TYPE "WorkspaceAssetStatus" AS ENUM ('UPLOAD_PENDING', 'UPLOAD_PROVISIONED', 'READY', 'FAILED', 'QUARANTINED', 'RETIRED');
CREATE TABLE "WorkspaceAsset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "provider" "WorkspaceAssetProvider" NOT NULL,
  "providerNamespace" TEXT NOT NULL,
  "providerKey" TEXT,
  "status" "WorkspaceAssetStatus" NOT NULL DEFAULT 'UPLOAD_PENDING',
  "byteSize" BIGINT,
  "provenance" JSONB NOT NULL,
  "uploadExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceAsset_byteSize_check" CHECK ("byteSize" IS NULL OR "byteSize" >= 0)
);
CREATE UNIQUE INDEX "WorkspaceAsset_provider_providerNamespace_providerKey_key" ON "WorkspaceAsset"("provider", "providerNamespace", "providerKey");
CREATE INDEX "WorkspaceAsset_workspaceId_status_createdAt_idx" ON "WorkspaceAsset"("workspaceId", "status", "createdAt");
ALTER TABLE "Media" ADD COLUMN "assetId" TEXT;
CREATE INDEX "Media_assetId_idx" ON "Media"("assetId");
ALTER TABLE "Media" ADD CONSTRAINT "Media_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "WorkspaceAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Provider identity is retained even after retirement. Never transfer an asset
-- between companies or recycle a bound provider key through an ordinary update.
CREATE FUNCTION "preserve_workspace_asset_identity"() RETURNS trigger AS $$
BEGIN
  IF NEW."workspaceId" IS DISTINCT FROM OLD."workspaceId"
     OR NEW."provider" IS DISTINCT FROM OLD."provider"
     OR NEW."providerNamespace" IS DISTINCT FROM OLD."providerNamespace"
     OR (OLD."providerKey" IS NOT NULL AND NEW."providerKey" IS DISTINCT FROM OLD."providerKey") THEN
    RAISE EXCEPTION 'Workspace asset identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "WorkspaceAsset_identity_guard" BEFORE UPDATE ON "WorkspaceAsset"
FOR EACH ROW EXECUTE FUNCTION "preserve_workspace_asset_identity"();
