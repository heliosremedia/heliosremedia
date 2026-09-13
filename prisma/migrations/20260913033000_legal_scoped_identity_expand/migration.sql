-- Staged expansion: do not enable duplicate types across companies yet.
-- Preserve old ON CONFLICT(type) writers until the separately reviewed cutover.
-- This extra database-only guard is intentional and is not modeled as a global
-- Prisma unique selector. New application reads/writes must always be scoped.
ALTER INDEX "LegalDocument_type_key" RENAME TO "LegalDocument_legacy_type_guard";
CREATE UNIQUE INDEX "LegalDocument_workspaceId_type_key" ON "LegalDocument"("workspaceId", "type");
