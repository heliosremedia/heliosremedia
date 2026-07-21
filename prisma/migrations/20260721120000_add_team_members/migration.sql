CREATE TYPE "TeamMemberCategory" AS ENUM ('LEADERSHIP', 'PRODUCTION', 'POST_PRODUCTION', 'CLIENT_CARE', 'MARKETING', 'OPERATIONS');

CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "biography" TEXT NOT NULL,
    "category" "TeamMemberCategory" NOT NULL DEFAULT 'PRODUCTION',
    "portraitStorageKey" TEXT,
    "portraitUrl" TEXT,
    "portraitAlt" TEXT,
    "focalX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "focalY" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeamMember_visible_displayOrder_idx" ON "TeamMember"("visible", "displayOrder");
CREATE INDEX "TeamMember_category_displayOrder_idx" ON "TeamMember"("category", "displayOrder");
