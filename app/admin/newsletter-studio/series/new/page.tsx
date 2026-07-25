import { requireAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import SeriesForm from "../../components/SeriesForm";
export default async function NewSeriesPage() { const session = await requireAdminSession(); if (session.role !== "OWNER" && session.role !== "ADMIN") redirect("/admin"); return <SeriesForm />; }
