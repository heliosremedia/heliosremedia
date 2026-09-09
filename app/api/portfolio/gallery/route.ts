import { NextResponse } from "next/server";
import { getDiscoveryPhotos } from "@/lib/portfolio-discovery";
import { getPublicWorkspaceId } from "@/lib/public-workspace";
import { getPortfolioDiscoverySettings } from "@/lib/portfolio-discovery-settings";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceId = await getPublicWorkspaceId();
  const settings = await getPortfolioDiscoverySettings(workspaceId);
  if (!settings.photoEnabled) return NextResponse.json({ success: false }, { status: 404 });
  const result = await getDiscoveryPhotos({
    workspaceId,
    mode: settings.photoOrderingMode,
    excludedProjectIds: settings.excludedProjectIds,
    excludedMediaIds: settings.excludedMediaIds,
    offset: Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0,
    count: settings.initialItemCount,
  });
  return NextResponse.json({ success: true, ...result });
}
