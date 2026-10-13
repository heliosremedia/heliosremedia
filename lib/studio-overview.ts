import "server-only";
import { notFound } from "next/navigation";
import { requireAdminSession } from "./auth/session";
import { studioEnabledFor } from "./studio-access";
import { getDashboardData } from "./dashboard";

/** No caller-supplied tenant selector, shared cache, provider request or mutation. */
export async function getStudioOverview() {
  const session = await requireAdminSession();
  if (!studioEnabledFor(session)) notFound();
  const data = await getDashboardData(session.workspaceId);
  return {
    generatedAt: data.generatedAt,
    operations: data.operations,
    website: data.website,
  };
}
export type StudioOverview = Awaited<ReturnType<typeof getStudioOverview>>;
