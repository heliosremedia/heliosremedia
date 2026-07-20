ALTER TABLE "AboutPageContent"
ADD COLUMN "founderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "founderEyebrow" TEXT NOT NULL DEFAULT 'Meet Helios',
ADD COLUMN "founderFirstName" TEXT NOT NULL DEFAULT 'Jake',
ADD COLUMN "founderRole" TEXT NOT NULL DEFAULT 'Founder · Creative · Storyteller',
ADD COLUMN "founderBody" TEXT NOT NULL DEFAULT E'Helios was built on a simple belief: real estate media can do more than document a home. It can elevate it.\n\nEvery listing has a story, and every agent deserves marketing that reflects the work they’ve put into earning it.\n\nWhen you work with Helios, you’re not just getting photos or video. You’re getting a partner who cares about the final result.',
ADD COLUMN "founderSignature" TEXT NOT NULL DEFAULT 'Jake Guerin',
ADD COLUMN "founderTitle" TEXT NOT NULL DEFAULT 'Founder of Helios',
ADD COLUMN "founderTeamNote" TEXT NOT NULL DEFAULT 'Today, Helios is powered by a growing team of photographers, editors, and creatives who share the same commitment to quality.',
ADD COLUMN "founderImageStorageKey" TEXT,
ADD COLUMN "founderImageUrl" TEXT,
ADD COLUMN "founderImageAlt" TEXT NOT NULL DEFAULT 'Jake Guerin, founder of Helios Real Estate Media';
