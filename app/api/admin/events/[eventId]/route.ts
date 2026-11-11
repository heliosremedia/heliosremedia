import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventAdmin, getEvent, cancelEvent, unscheduleEvent, auditEvent, validateEventImageSelection } from "@/lib/events/service";
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
    if (input.action === "unschedule") {
      if (input.confirm !== true) throw new Error("Confirm that all pending invitations should be unscheduled before editing.");
      const event = await unscheduleEvent(eventId,s.workspaceId); await auditEvent(s,eventId,"UNSCHEDULED"); return NextResponse.json({success:true,event});
    }
    const existing = await getEvent(eventId,s.workspaceId);
    const validated = eventDraftInput(existing,input);
    if (existing.deliveries.some(delivery => delivery.status === "PAUSED")) {
      const sameIds = (a:string[],b:string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
      if (validated.mode !== existing.mode || !sameIds(validated.clientIds,existing.clientIds) || !sameIds(validated.groupIds,existing.groupIds)) throw new Error("The saved audience cannot be changed after unscheduling. Create a new event for a different audience.");
    }
    await validateEventImageSelection(validated.imageUrl,s.workspaceId);
    await prisma.$transaction(async tx => {
      const result = await tx.eventInvitationEvent.updateMany({where:{id:eventId,workspaceId:s.workspaceId,status:"DRAFT",updatedAt:existing.updatedAt},data:validated});
      if (!result.count) throw new Error("Only unchanged drafts can be edited. Unschedule a not-yet-started event before editing.");
      if (await tx.eventDeliveryMessage.count({where:{delivery:{eventId}}})) throw new Error("Delivery has already started. This event cannot be edited.");
    });
    await auditEvent(s,eventId,"DRAFT_UPDATED"); return NextResponse.json({success:true,event:await getEvent(eventId,s.workspaceId)});
  } catch(e) { return eventError(e); }
}
