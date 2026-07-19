CREATE TABLE "AboutPageContent" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "heroEyebrow" TEXT NOT NULL DEFAULT 'About Helios',
    "heroHeadline" TEXT NOT NULL DEFAULT 'Presentation shapes perception.',
    "heroBody" TEXT NOT NULL DEFAULT 'Helios is a Northern Colorado real estate media studio built around one belief: thoughtful presentation changes how a property is seen, remembered, and valued.',
    "heroImageStorageKey" TEXT,
    "heroImageUrl" TEXT,
    "heroImageAlt" TEXT NOT NULL DEFAULT 'Refined contemporary interior photographed by Helios Real Estate Media',
    "storyEyebrow" TEXT NOT NULL DEFAULT 'Why we exist',
    "storyIntro" TEXT NOT NULL DEFAULT 'Real estate media is often treated as documentation. We see it as positioning—the first signal of care, quality, and value a buyer receives.',
    "storyHeadline" TEXT NOT NULL DEFAULT 'We create the visual language that helps exceptional properties feel impossible to overlook.',
    "storyBodyLeft" TEXT NOT NULL DEFAULT 'Photography, cinematic film, aerial perspectives, agent branding, and social content are approached as parts of the same campaign. The result is more coherent, more useful, and more memorable than a collection of disconnected deliverables.',
    "storyBodyRight" TEXT NOT NULL DEFAULT 'We work with agents, builders, designers, and property professionals who understand that presentation is not decoration. It is a strategic part of how trust is earned and value is communicated.',
    "principlesEyebrow" TEXT NOT NULL DEFAULT 'The Helios point of view',
    "principlesHeadline" TEXT NOT NULL DEFAULT 'Beauty with a purpose.',
    "principlesIntro" TEXT NOT NULL DEFAULT 'A clear set of principles keeps the work consistent while every property remains distinct.',
    "principles" JSONB NOT NULL,
    "galleryOneStorageKey" TEXT,
    "galleryOneUrl" TEXT,
    "galleryOneAlt" TEXT NOT NULL DEFAULT 'Luxury interior media created by Helios',
    "galleryTwoStorageKey" TEXT,
    "galleryTwoUrl" TEXT,
    "galleryTwoAlt" TEXT NOT NULL DEFAULT 'Architectural detail photographed by Helios',
    "galleryThreeStorageKey" TEXT,
    "galleryThreeUrl" TEXT,
    "galleryThreeAlt" TEXT NOT NULL DEFAULT 'Elevated property photography by Helios',
    "processEyebrow" TEXT NOT NULL DEFAULT 'The client experience',
    "processHeadline" TEXT NOT NULL DEFAULT 'Considered from first call to final delivery.',
    "process" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AboutPageContent_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AboutPageContent" ("id", "principles", "process", "updatedAt")
VALUES (
  'default',
  '[{"number":"01","title":"See the story","copy":"We look beyond rooms and square footage to find the light, rhythm, setting, and details that give a property its identity."},{"number":"02","title":"Create with intent","copy":"Every frame has a job: guide attention, build emotion, clarify value, or give the audience a reason to remember."},{"number":"03","title":"Protect the truth","copy":"Refined presentation should elevate what is already there. Honest color, natural perspective, and thoughtful composition keep the work credible."},{"number":"04","title":"Elevate the experience","copy":"The process matters as much as the final gallery. Preparation, communication, production, and delivery should all feel considered."}]'::jsonb,
  '[{"number":"01","title":"Prepare","copy":"We align on the property, audience, deliverables, and the moments that deserve special attention before production begins."},{"number":"02","title":"Create","copy":"Photography, film, aerial, and supporting content are captured as one connected visual system—not isolated assets."},{"number":"03","title":"Refine","copy":"Every selection is edited for clarity, consistency, natural color, and the pacing required by its final destination."},{"number":"04","title":"Deliver","copy":"Organized, campaign-ready media arrives prepared for listings, websites, social platforms, and future marketing needs."}]'::jsonb,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
