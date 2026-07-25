import { requireAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import NewsletterDashboard from "./components/NewsletterDashboard";

export const dynamic = "force-dynamic";
export default async function NewsletterStudioPage() {
  const session = await requireAdminSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") redirect("/admin");
  return <NewsletterDashboard />;
}
