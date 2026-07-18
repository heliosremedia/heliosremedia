import type { CtaPlacementSlot } from "@/app/generated/prisma/client";
import { getCtaForSlot, type PublicCta } from "@/lib/ctas";
import ManagedCtaContent from "./ManagedCtaContent";

export default async function ManagedCtaSection({ slot, fallback }: { slot: CtaPlacementSlot; fallback: PublicCta }) {
  const cta = await getCtaForSlot(slot);
  return <ManagedCtaContent cta={cta ?? fallback} />;
}
