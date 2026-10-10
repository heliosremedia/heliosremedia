import type { Metadata } from "next";
import { getStudioOverview } from "@/lib/studio-overview";
import CommandCenter from "./CommandCenter";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Command Center | Studio V2", robots: { index: false, follow: false } };
export default async function StudioPage() {
  return <CommandCenter data={await getStudioOverview()} />;
}
