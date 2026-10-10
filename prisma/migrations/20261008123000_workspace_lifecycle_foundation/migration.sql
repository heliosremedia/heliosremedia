-- Additive default preserves every existing workspace. No operator enrollment.
CREATE TYPE "WorkspaceLifecycleState" AS ENUM ('ACTIVE', 'SUSPENDED');
ALTER TABLE "Workspace" ADD COLUMN "lifecycleState" "WorkspaceLifecycleState" NOT NULL DEFAULT 'ACTIVE', ADD COLUMN "lifecycleRevision" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "PlatformLifecycleOperator" (
  "userId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformLifecycleOperator_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "PlatformLifecycleOperator" ADD CONSTRAINT "PlatformLifecycleOperator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
