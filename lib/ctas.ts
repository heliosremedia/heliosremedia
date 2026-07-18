import type { CtaActionType, CtaPlacementSlot } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type PublicCta = {
  id: string;
  internalName: string;
  eyebrow: string | null;
  headline: string;
  body: string | null;
  primaryLabel: string;
  primaryActionType: CtaActionType;
  primaryValue: string | null;
  secondaryLabel: string | null;
  secondaryActionType: CtaActionType | null;
  secondaryValue: string | null;
};

export const ctaSlotLabels: Record<CtaPlacementSlot, string> = {
  HOME_PRIMARY: "Homepage primary",
  ABOUT_FOOTER: "About page footer",
  SERVICES_FOOTER: "Services page footer",
  FAQ_FOOTER: "FAQ page footer",
  PORTFOLIO_FOOTER: "Portfolio page footer",
};

export const defaultHomeCta: PublicCta = {
  id: "default-home-cta",
  internalName: "Homepage primary conversion",
  eyebrow: null,
  headline: "The showing begins before the front door opens.",
  body: "Professional photography and cinematic storytelling that shape first impressions long before buyers step inside.",
  primaryLabel: "Book Your Shoot",
  primaryActionType: "BOOKING",
  primaryValue: null,
  secondaryLabel: "Explore Services",
  secondaryActionType: "INTERNAL",
  secondaryValue: "/services",
};

export const defaultPageCtas: Record<Exclude<CtaPlacementSlot, "HOME_PRIMARY">, PublicCta> = {
  ABOUT_FOOTER: { id: "default-about-cta", internalName: "About footer", eyebrow: "Fort Collins · Northern Colorado", headline: "Ready to shape the first impression?", body: "Tell us about the property, the audience, and what the campaign needs to accomplish. We'll help build the right media plan.", primaryLabel: "Book Your Shoot", primaryActionType: "BOOKING", primaryValue: null, secondaryLabel: "Explore the work", secondaryActionType: "INTERNAL", secondaryValue: "/portfolio" },
  SERVICES_FOOTER: { id: "default-services-cta", internalName: "Services footer", eyebrow: "Build the right campaign", headline: "Let's make the property impossible to overlook.", body: null, primaryLabel: "Book Your Shoot", primaryActionType: "BOOKING", primaryValue: null, secondaryLabel: "View the portfolio", secondaryActionType: "INTERNAL", secondaryValue: "/portfolio" },
  FAQ_FOOTER: { id: "default-faq-cta", internalName: "FAQ footer", eyebrow: "Still curious?", headline: "Let's talk through your project.", body: "Tell us what you're planning and we'll help identify the right media package.", primaryLabel: "Book Your Shoot", primaryActionType: "BOOKING", primaryValue: null, secondaryLabel: "Explore services", secondaryActionType: "INTERNAL", secondaryValue: "/services" },
  PORTFOLIO_FOOTER: { id: "default-portfolio-cta", internalName: "Portfolio footer", eyebrow: "Your property, intentionally presented", headline: "Ready to create the next story?", body: "Build a tailored media campaign designed around the property, the audience, and the result you need.", primaryLabel: "Book Your Shoot", primaryActionType: "BOOKING", primaryValue: null, secondaryLabel: "Explore services", secondaryActionType: "INTERNAL", secondaryValue: "/services" },
};

export async function getCtaForSlot(slot: CtaPlacementSlot): Promise<PublicCta | null> {
  try {
    const placement = await prisma.ctaPlacement.findUnique({
      where: { slot },
      select: { cta: { select: { id: true, internalName: true, eyebrow: true, headline: true, body: true, primaryLabel: true, primaryActionType: true, primaryValue: true, secondaryLabel: true, secondaryActionType: true, secondaryValue: true, published: true } } },
    });
    return placement?.cta.published ? placement.cta : null;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("CTA settings unavailable; using page defaults.", error);
    return null;
  }
}
