import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventAdmin, eventOptions, eventInclude, auditEvent } from "@/lib/events/service";
import { eventInput } from "@/lib/events/core";
import { eventError } from "@/lib/events/api";
export async function GET() {
  try { const s = await eventAdmin(); const events = await prisma.eventInvitationEvent.findMany({where:{workspaceId:s.workspaceId},include:eventInclude,orderBy:{createdAt:"desc"},take:100}); return NextResponse.json({success:true,events,...await eventOptions(s.workspaceId)},{headers:{"Cache-Control":"no-store"}}); } catch(e) { return eventError(e); }
}
export async function POST(request:Request) {
  try { const s = await eventAdmin(); const input = eventInput(await request.json()); const event = await prisma.eventInvitationEvent.create({data:{...input,workspaceId:s.workspaceId,createdById:s.userId},include:eventInclude}); await auditEvent(s,event.id,"DRAFT_CREATED"); return NextResponse.json({success:true,event}); } catch(e) { return eventError(e); }
}
