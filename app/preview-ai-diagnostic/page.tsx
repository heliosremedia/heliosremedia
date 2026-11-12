// TEMPORARY: remove before production release.
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import Diagnostic from "./Diagnostic";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (process.env.VERCEL_ENV !== "preview") notFound();
  const session = await requireAdminSession();
  if (!["OWNER", "ADMIN"].includes(session.role)) notFound();
  return <Diagnostic />;
}
