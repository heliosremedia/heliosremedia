CREATE TYPE "ReferralCampaignStatus" AS ENUM ('DRAFT', 'APPROVED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "ReferralAudienceMode" AS ENUM ('INDIVIDUALS', 'GROUPS', 'FILTERED', 'ALL_ELIGIBLE');
CREATE TYPE "ReferralInvitationStatus" AS ENUM ('DRAFT', 'APPROVED', 'SCHEDULED', 'SENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'FAILED', 'UNSUBSCRIBED', 'CANCELLED');
CREATE TYPE "ReferralStatus" AS ENUM ('INVITED', 'VISITED', 'SUBMITTED', 'CONTACTED', 'QUALIFIED', 'BOOKED', 'COMPLETED', 'REWARD_ELIGIBLE', 'REWARD_ISSUED', 'DISQUALIFIED', 'DECLINED', 'EXPIRED', 'DUPLICATE', 'CANCELLED', 'NEEDS_REVIEW');
CREATE TYPE "ReferralAttributionStatus" AS ENUM ('CONFIRMED', 'NEEDS_REVIEW', 'REJECTED');
CREATE TYPE "ReferralRewardType" AS ENUM ('ACCOUNT_CREDIT', 'PERCENTAGE_DISCOUNT', 'FIXED_VALUE_GIFT', 'COMPLIMENTARY_SERVICE', 'CUSTOM', 'NONE');
CREATE TYPE "ReferralRewardStatus" AS ENUM ('NOT_ELIGIBLE', 'PENDING_REVIEW', 'ELIGIBLE', 'APPROVED', 'ISSUED', 'DECLINED', 'REVERSED');
CREATE TYPE "ReferralCommunicationKind" AS ENUM ('INVITATION', 'FOLLOW_UP', 'REFERRAL_RECEIVED', 'REFERRED_PERSON_ACKNOWLEDGMENT', 'QUALIFIED_UPDATE', 'COMPLETION_THANK_YOU', 'REWARD_ELIGIBLE', 'REWARD_ISSUED', 'TEST');
CREATE TYPE "ReferralCommunicationStatus" AS ENUM ('DRAFT', 'APPROVED', 'SCHEDULED', 'SENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'FAILED', 'CANCELLED', 'UNSUBSCRIBED');

CREATE TABLE "ReferralCampaign" (
  "id" TEXT NOT NULL,
  "internalName" TEXT NOT NULL,
  "publicTitle" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "status" "ReferralCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "audienceMode" "ReferralAudienceMode" NOT NULL,
  "audienceRules" JSONB NOT NULL,
  "referralOffer" TEXT,
  "advocateReward" TEXT,
  "referredCustomerOffer" TEXT,
  "eligibilityRules" TEXT,
  "qualificationRules" TEXT,
  "rewardInstructions" TEXT,
  "maxRewardsPerAdvocate" INTEGER,
  "terms" TEXT NOT NULL,
  "senderName" TEXT,
  "senderEmail" TEXT,
  "replyTo" TEXT,
  "landingHeadline" TEXT NOT NULL,
  "landingBody" TEXT NOT NULL,
  "landingThankYou" TEXT NOT NULL,
  "privacyNotice" TEXT NOT NULL,
  "invitationSubject" TEXT NOT NULL,
  "invitationPreviewText" TEXT,
  "invitationBody" TEXT NOT NULL,
  "followUpConfiguration" JSONB NOT NULL,
  "communicationTemplates" JSONB NOT NULL,
  "aiMetadata" JSONB,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "referralExpirationDays" INTEGER NOT NULL DEFAULT 90,
  "approvedRevisionId" TEXT,
  "activatedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralCampaignAudience" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "groupId" TEXT,
  "clientId" TEXT,
  "excluded" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralCampaignAudience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralAdvocate" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "recommendationReason" TEXT,
  "recommendationScore" INTEGER,
  "recommendationWarnings" JSONB,
  "dismissedAt" TIMESTAMP(3),
  "includedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralAdvocate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralInvitation" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "advocateId" TEXT NOT NULL,
  "status" "ReferralInvitationStatus" NOT NULL DEFAULT 'DRAFT',
  "subject" TEXT NOT NULL,
  "previewText" TEXT,
  "body" TEXT NOT NULL,
  "approvedSnapshot" JSONB,
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "followUpStoppedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralLink" (
  "id" TEXT NOT NULL,
  "invitationId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "advocateId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "visitCount" INTEGER NOT NULL DEFAULT 0,
  "firstVisitedAt" TIMESTAMP(3),
  "lastVisitedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralSubmission" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "advocateId" TEXT,
  "linkId" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "phone" TEXT,
  "normalizedPhone" TEXT,
  "preferredContactMethod" TEXT NOT NULL,
  "message" TEXT,
  "submittedBy" TEXT NOT NULL,
  "consentAcknowledged" BOOLEAN NOT NULL,
  "consentText" TEXT NOT NULL,
  "consentedAt" TIMESTAMP(3) NOT NULL,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "status" "ReferralStatus" NOT NULL DEFAULT 'SUBMITTED',
  "attributionStatus" "ReferralAttributionStatus" NOT NULL DEFAULT 'CONFIRMED',
  "attributionReason" TEXT,
  "duplicateOfId" TEXT,
  "matchedClientId" TEXT,
  "inquiryId" TEXT,
  "externalOrderId" TEXT,
  "internalNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralStatusEvent" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "fromStatus" "ReferralStatus",
  "toStatus" "ReferralStatus" NOT NULL,
  "reason" TEXT,
  "actorId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralReward" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "advocateId" TEXT NOT NULL,
  "type" "ReferralRewardType" NOT NULL,
  "status" "ReferralRewardStatus" NOT NULL DEFAULT 'NOT_ELIGIBLE',
  "value" TEXT,
  "eligibilityReason" TEXT,
  "fulfillmentNotes" TEXT,
  "externalReference" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "issuedById" TEXT,
  "issuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralCommunication" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "invitationId" TEXT,
  "submissionId" TEXT,
  "kind" "ReferralCommunicationKind" NOT NULL,
  "status" "ReferralCommunicationStatus" NOT NULL DEFAULT 'DRAFT',
  "recipientEmail" TEXT NOT NULL,
  "recipientName" TEXT,
  "subject" TEXT NOT NULL,
  "htmlSnapshot" TEXT,
  "contentHash" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "idempotencyKey" TEXT,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralCommunication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralCampaignRevision" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralCampaignRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralAuditEvent" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT,
  "submissionId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralCampaign_approvedRevisionId_key" ON "ReferralCampaign"("approvedRevisionId");
CREATE INDEX "ReferralCampaign_status_startsAt_endsAt_idx" ON "ReferralCampaign"("status", "startsAt", "endsAt");
CREATE INDEX "ReferralCampaign_createdById_createdAt_idx" ON "ReferralCampaign"("createdById", "createdAt");
CREATE INDEX "ReferralCampaignAudience_campaignId_excluded_idx" ON "ReferralCampaignAudience"("campaignId", "excluded");
CREATE INDEX "ReferralCampaignAudience_groupId_idx" ON "ReferralCampaignAudience"("groupId");
CREATE INDEX "ReferralCampaignAudience_clientId_idx" ON "ReferralCampaignAudience"("clientId");
CREATE UNIQUE INDEX "ReferralCampaignAudience_campaignId_groupId_clientId_exclud_key" ON "ReferralCampaignAudience"("campaignId", "groupId", "clientId", "excluded");
CREATE INDEX "ReferralAdvocate_clientId_createdAt_idx" ON "ReferralAdvocate"("clientId", "createdAt");
CREATE INDEX "ReferralAdvocate_campaignId_dismissedAt_idx" ON "ReferralAdvocate"("campaignId", "dismissedAt");
CREATE UNIQUE INDEX "ReferralAdvocate_campaignId_clientId_key" ON "ReferralAdvocate"("campaignId", "clientId");
CREATE INDEX "ReferralInvitation_campaignId_status_scheduledAt_idx" ON "ReferralInvitation"("campaignId", "status", "scheduledAt");
CREATE INDEX "ReferralInvitation_advocateId_createdAt_idx" ON "ReferralInvitation"("advocateId", "createdAt");
CREATE INDEX "ReferralInvitation_providerMessageId_idx" ON "ReferralInvitation"("providerMessageId");
CREATE UNIQUE INDEX "ReferralLink_invitationId_key" ON "ReferralLink"("invitationId");
CREATE UNIQUE INDEX "ReferralLink_tokenHash_key" ON "ReferralLink"("tokenHash");
CREATE UNIQUE INDEX "ReferralLink_code_key" ON "ReferralLink"("code");
CREATE INDEX "ReferralLink_advocateId_createdAt_idx" ON "ReferralLink"("advocateId", "createdAt");
CREATE INDEX "ReferralLink_campaignId_createdAt_idx" ON "ReferralLink"("campaignId", "createdAt");
CREATE INDEX "ReferralLink_code_expiresAt_idx" ON "ReferralLink"("code", "expiresAt");
CREATE INDEX "ReferralSubmission_campaignId_status_createdAt_idx" ON "ReferralSubmission"("campaignId", "status", "createdAt");
CREATE INDEX "ReferralSubmission_advocateId_createdAt_idx" ON "ReferralSubmission"("advocateId", "createdAt");
CREATE INDEX "ReferralSubmission_normalizedEmail_createdAt_idx" ON "ReferralSubmission"("normalizedEmail", "createdAt");
CREATE INDEX "ReferralSubmission_normalizedPhone_createdAt_idx" ON "ReferralSubmission"("normalizedPhone", "createdAt");
CREATE INDEX "ReferralSubmission_attributionStatus_createdAt_idx" ON "ReferralSubmission"("attributionStatus", "createdAt");
CREATE INDEX "ReferralSubmission_inquiryId_idx" ON "ReferralSubmission"("inquiryId");
CREATE INDEX "ReferralStatusEvent_submissionId_createdAt_idx" ON "ReferralStatusEvent"("submissionId", "createdAt");
CREATE INDEX "ReferralStatusEvent_actorId_createdAt_idx" ON "ReferralStatusEvent"("actorId", "createdAt");
CREATE INDEX "ReferralReward_status_createdAt_idx" ON "ReferralReward"("status", "createdAt");
CREATE INDEX "ReferralReward_advocateId_status_idx" ON "ReferralReward"("advocateId", "status");
CREATE UNIQUE INDEX "ReferralReward_submissionId_advocateId_key" ON "ReferralReward"("submissionId", "advocateId");
CREATE UNIQUE INDEX "ReferralCommunication_idempotencyKey_key" ON "ReferralCommunication"("idempotencyKey");
CREATE INDEX "ReferralCommunication_campaignId_status_scheduledAt_idx" ON "ReferralCommunication"("campaignId", "status", "scheduledAt");
CREATE INDEX "ReferralCommunication_invitationId_kind_idx" ON "ReferralCommunication"("invitationId", "kind");
CREATE INDEX "ReferralCommunication_submissionId_kind_idx" ON "ReferralCommunication"("submissionId", "kind");
CREATE INDEX "ReferralCommunication_providerMessageId_idx" ON "ReferralCommunication"("providerMessageId");
CREATE INDEX "ReferralCampaignRevision_contentHash_idx" ON "ReferralCampaignRevision"("contentHash");
CREATE INDEX "ReferralCampaignRevision_approvedById_approvedAt_idx" ON "ReferralCampaignRevision"("approvedById", "approvedAt");
CREATE UNIQUE INDEX "ReferralCampaignRevision_campaignId_revisionNumber_key" ON "ReferralCampaignRevision"("campaignId", "revisionNumber");
CREATE INDEX "ReferralAuditEvent_campaignId_createdAt_idx" ON "ReferralAuditEvent"("campaignId", "createdAt");
CREATE INDEX "ReferralAuditEvent_submissionId_createdAt_idx" ON "ReferralAuditEvent"("submissionId", "createdAt");
CREATE INDEX "ReferralAuditEvent_actorId_createdAt_idx" ON "ReferralAuditEvent"("actorId", "createdAt");

ALTER TABLE "ReferralCampaign" ADD CONSTRAINT "ReferralCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralCampaign" ADD CONSTRAINT "ReferralCampaign_approvedRevisionId_fkey" FOREIGN KEY ("approvedRevisionId") REFERENCES "ReferralCampaignRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralCampaignAudience" ADD CONSTRAINT "ReferralCampaignAudience_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralCampaignAudience" ADD CONSTRAINT "ReferralCampaignAudience_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunicationGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralCampaignAudience" ADD CONSTRAINT "ReferralCampaignAudience_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CommunicationClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralAdvocate" ADD CONSTRAINT "ReferralAdvocate_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralAdvocate" ADD CONSTRAINT "ReferralAdvocate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CommunicationClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralInvitation" ADD CONSTRAINT "ReferralInvitation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralInvitation" ADD CONSTRAINT "ReferralInvitation_advocateId_fkey" FOREIGN KEY ("advocateId") REFERENCES "ReferralAdvocate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralLink" ADD CONSTRAINT "ReferralLink_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "ReferralInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralLink" ADD CONSTRAINT "ReferralLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralLink" ADD CONSTRAINT "ReferralLink_advocateId_fkey" FOREIGN KEY ("advocateId") REFERENCES "ReferralAdvocate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralSubmission" ADD CONSTRAINT "ReferralSubmission_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralSubmission" ADD CONSTRAINT "ReferralSubmission_advocateId_fkey" FOREIGN KEY ("advocateId") REFERENCES "ReferralAdvocate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralSubmission" ADD CONSTRAINT "ReferralSubmission_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ReferralLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralSubmission" ADD CONSTRAINT "ReferralSubmission_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "ReferralSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralSubmission" ADD CONSTRAINT "ReferralSubmission_matchedClientId_fkey" FOREIGN KEY ("matchedClientId") REFERENCES "CommunicationClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralSubmission" ADD CONSTRAINT "ReferralSubmission_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralStatusEvent" ADD CONSTRAINT "ReferralStatusEvent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ReferralSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralStatusEvent" ADD CONSTRAINT "ReferralStatusEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ReferralSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_advocateId_fkey" FOREIGN KEY ("advocateId") REFERENCES "ReferralAdvocate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralCommunication" ADD CONSTRAINT "ReferralCommunication_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralCommunication" ADD CONSTRAINT "ReferralCommunication_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "ReferralInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralCommunication" ADD CONSTRAINT "ReferralCommunication_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ReferralSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralCampaignRevision" ADD CONSTRAINT "ReferralCampaignRevision_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralCampaignRevision" ADD CONSTRAINT "ReferralCampaignRevision_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralAuditEvent" ADD CONSTRAINT "ReferralAuditEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralAuditEvent" ADD CONSTRAINT "ReferralAuditEvent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ReferralSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralAuditEvent" ADD CONSTRAINT "ReferralAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
