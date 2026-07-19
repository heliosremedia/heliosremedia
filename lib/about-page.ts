import { prisma } from "@/lib/prisma";

export type AboutListItem = { number: string; title: string; copy: string };

export type PublicAboutPageContent = {
  id: string;
  heroEyebrow: string;
  heroHeadline: string;
  heroBody: string;
  heroImageStorageKey: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string;
  storyEyebrow: string;
  storyIntro: string;
  storyHeadline: string;
  storyBodyLeft: string;
  storyBodyRight: string;
  founderEnabled: boolean;
  founderEyebrow: string;
  founderFirstName: string;
  founderRole: string;
  founderBody: string;
  founderSignature: string;
  founderTitle: string;
  founderTeamNote: string;
  founderImageStorageKey: string | null;
  founderImageUrl: string | null;
  founderImageAlt: string;
  principlesEyebrow: string;
  principlesHeadline: string;
  principlesIntro: string;
  principles: AboutListItem[];
  galleryOneStorageKey: string | null;
  galleryOneUrl: string | null;
  galleryOneAlt: string;
  galleryTwoStorageKey: string | null;
  galleryTwoUrl: string | null;
  galleryTwoAlt: string;
  galleryThreeStorageKey: string | null;
  galleryThreeUrl: string | null;
  galleryThreeAlt: string;
  processEyebrow: string;
  processHeadline: string;
  process: AboutListItem[];
};

const defaultPrinciples: AboutListItem[] = [
  { number: "01", title: "See the story", copy: "We look beyond rooms and square footage to find the light, rhythm, setting, and details that give a property its identity." },
  { number: "02", title: "Create with intent", copy: "Every frame has a job: guide attention, build emotion, clarify value, or give the audience a reason to remember." },
  { number: "03", title: "Protect the truth", copy: "Refined presentation should elevate what is already there. Honest color, natural perspective, and thoughtful composition keep the work credible." },
  { number: "04", title: "Elevate the experience", copy: "The process matters as much as the final gallery. Preparation, communication, production, and delivery should all feel considered." },
];

const defaultProcess: AboutListItem[] = [
  { number: "01", title: "Prepare", copy: "We align on the property, audience, deliverables, and the moments that deserve special attention before production begins." },
  { number: "02", title: "Create", copy: "Photography, film, aerial, and supporting content are captured as one connected visual system—not isolated assets." },
  { number: "03", title: "Refine", copy: "Every selection is edited for clarity, consistency, natural color, and the pacing required by its final destination." },
  { number: "04", title: "Deliver", copy: "Organized, campaign-ready media arrives prepared for listings, websites, social platforms, and future marketing needs." },
];

export const defaultAboutPageContent: PublicAboutPageContent = {
  id: "default",
  heroEyebrow: "About Helios",
  heroHeadline: "Presentation shapes perception.",
  heroBody: "Helios is a Northern Colorado real estate media studio built around one belief: thoughtful presentation changes how a property is seen, remembered, and valued.",
  heroImageStorageKey: null,
  heroImageUrl: "/approach/helios-approach.jpg",
  heroImageAlt: "Refined contemporary interior photographed by Helios Real Estate Media",
  storyEyebrow: "Why we exist",
  storyIntro: "Real estate media is often treated as documentation. We see it as positioning—the first signal of care, quality, and value a buyer receives.",
  storyHeadline: "We create the visual language that helps exceptional properties feel impossible to overlook.",
  storyBodyLeft: "Photography, cinematic film, aerial perspectives, agent branding, and social content are approached as parts of the same campaign. The result is more coherent, more useful, and more memorable than a collection of disconnected deliverables.",
  storyBodyRight: "We work with agents, builders, designers, and property professionals who understand that presentation is not decoration. It is a strategic part of how trust is earned and value is communicated.",
  founderEnabled: false,
  founderEyebrow: "Meet Helios",
  founderFirstName: "Jake",
  founderRole: "Founder · Creative · Storyteller",
  founderBody: "Helios was built on a simple belief: real estate media can do more than document a home. It can elevate it.\n\nEvery listing has a story, and every agent deserves marketing that reflects the work they’ve put into earning it.\n\nWhen you work with Helios, you’re not just getting photos or video. You’re getting a partner who cares about the final result.",
  founderSignature: "Jake Guerin",
  founderTitle: "Founder of Helios",
  founderTeamNote: "Today, Helios is powered by a growing team of photographers, editors, and creatives who share the same commitment to quality.",
  founderImageStorageKey: null,
  founderImageUrl: null,
  founderImageAlt: "Jake Guerin, founder of Helios Real Estate Media",
  principlesEyebrow: "The Helios point of view",
  principlesHeadline: "Beauty with a purpose.",
  principlesIntro: "A clear set of principles keeps the work consistent while every property remains distinct.",
  principles: defaultPrinciples,
  galleryOneStorageKey: null,
  galleryOneUrl: "/standard/standard-8.jpg",
  galleryOneAlt: "Luxury interior media created by Helios",
  galleryTwoStorageKey: null,
  galleryTwoUrl: "/standard/standard-3.jpg",
  galleryTwoAlt: "Architectural detail photographed by Helios",
  galleryThreeStorageKey: null,
  galleryThreeUrl: "/standard/standard-12.jpg",
  galleryThreeAlt: "Elevated property photography by Helios",
  processEyebrow: "The client experience",
  processHeadline: "Considered from first call to final delivery.",
  process: defaultProcess,
};

function list(value: unknown, fallback: AboutListItem[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((item): item is AboutListItem => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return [record.number, record.title, record.copy].every((field) => typeof field === "string");
  });
  return items.length ? items : fallback;
}

export async function getAboutPageContent(): Promise<PublicAboutPageContent> {
  try {
    const content = await prisma.aboutPageContent.findUnique({ where: { id: "default" } });
    if (!content) return defaultAboutPageContent;
    return {
      ...content,
      heroImageUrl: content.heroImageUrl ?? defaultAboutPageContent.heroImageUrl,
      founderImageUrl: content.founderImageUrl ?? defaultAboutPageContent.founderImageUrl,
      galleryOneUrl: content.galleryOneUrl ?? defaultAboutPageContent.galleryOneUrl,
      galleryTwoUrl: content.galleryTwoUrl ?? defaultAboutPageContent.galleryTwoUrl,
      galleryThreeUrl: content.galleryThreeUrl ?? defaultAboutPageContent.galleryThreeUrl,
      principles: list(content.principles, defaultPrinciples),
      process: list(content.process, defaultProcess),
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("Using default About content because the database is unavailable.", error);
    return defaultAboutPageContent;
  }
}
