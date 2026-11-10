import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventAdmin, getEvent, cancelEvent, auditEvent, validateEventImageSelection } from "@/lib/events/service";
import { eventDraftInput } from "@/lib/events/core";
import { eventError } from "@/lib/events/api";
type Context = {params:Promise<{eventId:string}>};
export async function GET(_request:Request,ctx:Context) {
  try { const s = await eventAdmin(); return NextResponse.json({success:true,event:await getEvent((await ctx.params).eventId,s.workspaceId)},{headers:{"Cache-Control":"no-store"}}); } catch(e) { return eventError(e); }
}
export async function PATCH(request:Request,ctx:Context) {
  try {
    const s = await eventAdmin(); const {eventId} = await ctx.params; const input = await request.json();
    if (input.action === "cancel") { const event = await cancelEvent(eventId,s.workspaceId); await auditEvent(s,eventId,"CANCELLED"); return NextResponse.json({success:true,event}); }
    const existing = await getEvent(eventId,s.workspaceId);
    const validated = eventDraftInput(existing,input);
    await validateEventImageSelection(validated.imageUrl,s.workspaceId);
    const result = await prisma.eventInvitationEvent.updateMany({where:{id:eventId,workspaceId:s.workspaceId,status:"DRAFT",updatedAt:existing.updatedAt},data:validated});
    if (!result.count) throw new Error("Only unchanged drafts can be edited. Cancel scheduled deliveries before creating a replacement event.");
    await auditEvent(s,eventId,"DRAFT_UPDATED"); return NextResponse.json({success:true,event:await getEvent(eventId,s.workspaceId)});
  } catch(e) { return eventError(e); }
}
