ALTER TABLE "Project" ADD COLUMN "socialImageMediaId" TEXT;

CREATE UNIQUE INDEX "Project_socialImageMediaId_key"
ON "Project"("socialImageMediaId");

ALTER TABLE "Project"
ADD CONSTRAINT "Project_socialImageMediaId_fkey"
FOREIGN KEY ("socialImageMediaId") REFERENCES "Media"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
