import { requireAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import SeriesForm from "../../components/SeriesForm";
export default async function EditSeriesPage({ params }: { params: Promise<{ seriesId: string }> }) { const session = await requireAdminSession(); if (session.role !== "OWNER" && session.role !== "ADMIN") redirect("/admin"); const { seriesId } = await params; return <SeriesForm seriesId={seriesId} />; }
