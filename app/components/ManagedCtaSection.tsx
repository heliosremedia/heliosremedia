import type { CtaPlacementSlot } from "@/app/generated/prisma/client";
import { getCtaForSlot, type PublicCta } from "@/lib/ctas";
import { getSiteSettings } from "@/lib/site-settings";
import ManagedCtaContent from "./ManagedCtaContent";

export default async function ManagedCtaSection({ slot, fallback }: { slot: CtaPlacementSlot; fallback: PublicCta }) {
  const [cta, settings] = await Promise.all([getCtaForSlot(slot), getSiteSettings()]);
  return <ManagedCtaContent cta={cta ?? fallback} availabilityMessage={settings.availabilityMessage} />;
}
