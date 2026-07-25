CREATE TABLE "CommunicationGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationGroupMembership" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationGroupMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationGroup_normalizedName_key" ON "CommunicationGroup"("normalizedName");
CREATE INDEX "CommunicationGroup_name_idx" ON "CommunicationGroup"("name");
CREATE UNIQUE INDEX "CommunicationGroupMembership_groupId_clientId_key" ON "CommunicationGroupMembership"("groupId", "clientId");
CREATE INDEX "CommunicationGroupMembership_clientId_idx" ON "CommunicationGroupMembership"("clientId");

ALTER TABLE "CommunicationGroupMembership"
ADD CONSTRAINT "CommunicationGroupMembership_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "CommunicationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunicationGroupMembership"
ADD CONSTRAINT "CommunicationGroupMembership_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "CommunicationClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
