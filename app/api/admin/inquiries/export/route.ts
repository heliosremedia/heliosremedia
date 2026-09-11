import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { inquiryAssigneeWhere } from "@/lib/inquiry-ownership";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function cell(value: string | null | undefined) { return `"${(value || "").replaceAll('"', '""')}"`; }
export async function GET() {
  const session = await getAdminSession();
  if (!session) return new Response("Authentication required.", { status: 401 });
  if (!["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return new Response("Editor access is required.", { status: 403 });
  const scope = await getContentOwnershipScope(session.workspaceId);
  const inquiries = await prisma.inquiry.findMany({ where: scope, orderBy: { createdAt: "desc" }, include: { requestedServices: { where: { service: { workspaceId: session.workspaceId } }, include: { service: { select: { name: true } } } }, assignedTo: { where: inquiryAssigneeWhere(session.workspaceId), select: { displayName: true } } } });
  const rows = [["Created","Status","Name","Email","Phone","Property","City","State","Postal Code","Preferred Date","Services","Assignee","Follow Up","UTM Source","UTM Medium","UTM Campaign","Source Page","Message"].map(cell).join(","), ...inquiries.map((item) => [item.createdAt.toISOString(),item.status,item.name,item.email,item.phone,item.propertyAddress,item.city,item.state,item.postalCode,item.desiredDate?.toISOString().slice(0,10),item.requestedServices.map(({service})=>service.name).join("; "),item.assignedTo?.displayName,item.followUpAt?.toISOString(),item.utmSource,item.utmMedium,item.utmCampaign,item.sourcePage,item.message].map(cell).join(","))];
  return new Response(rows.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="helios-inquiries-${new Date().toISOString().slice(0,10)}.csv"` } });
}
