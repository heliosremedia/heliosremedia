-- Legacy schedules remain inert. Only a new, explicit post-deployment schedule
-- writes execution authorization.
ALTER TABLE "ReferralCampaign"
ADD COLUMN "executionAuthorizedAt" TIMESTAMP(3);

CREATE TABLE "ReferralCronInvocation" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "authenticated" BOOLEAN NOT NULL DEFAULT false,
  "campaignsInspected" INTEGER NOT NULL DEFAULT 0,
  "campaignsEligible" INTEGER NOT NULL DEFAULT 0,
  "campaignsRejected" INTEGER NOT NULL DEFAULT 0,
  "communicationsDue" INTEGER NOT NULL DEFAULT 0,
  "communicationsClaimed" INTEGER NOT NULL DEFAULT 0,
  "communicationsSkipped" INTEGER NOT NULL DEFAULT 0,
  "providerSubmissionsAttempted" INTEGER NOT NULL DEFAULT 0,
  "providerSubmissionsAccepted" INTEGER NOT NULL DEFAULT 0,
  "providerSubmissionsFailed" INTEGER NOT NULL DEFAULT 0,
  "terminalResult" TEXT,
  "sanitizedError" TEXT,
  CONSTRAINT "ReferralCronInvocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReferralCronInvocation_startedAt_idx" ON "ReferralCronInvocation"("startedAt");
CREATE INDEX "ReferralCronInvocation_terminalResult_startedAt_idx" ON "ReferralCronInvocation"("terminalResult", "startedAt");
