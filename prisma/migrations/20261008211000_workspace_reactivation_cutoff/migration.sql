-- Additive, default-null compatibility. Existing schedules are not rewritten.
ALTER TABLE "Workspace" ADD COLUMN "lastReactivatedAt" TIMESTAMPTZ(3);
