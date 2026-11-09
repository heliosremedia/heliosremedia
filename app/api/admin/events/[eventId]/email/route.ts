import { NextResponse } from "next/server";
import { eventAdmin, getEvent, cancelEvent, scheduleEvent, auditEvent } from "@/lib/events/service";
import { STAGES } from "@/lib/events/core";
import { eventError } from "@/lib/events/api";
import { renderEventEmail } from "@/lib/events/email";
import { sendTestCampaign } from "@/lib/client-communications/email";
export async function POST(request:Request,ctx:{params:Promise<{eventId:string}>}) {
  try {
    const s = await eventAdmin(); const {eventId} = await ctx.params; const input = await request.json(); const event = await getEvent(eventId,s.workspaceId);
    if (!STAGES.includes(input.stage)) throw new Error("Choose an email stage.");
    if (input.action === "preview") return NextResponse.json({success:true,...renderEventEmail(event,input.stage)});
    if (input.action === "cancel") { const updated = await cancelEvent(eventId,s.workspaceId,input.stage); await auditEvent(s,eventId,"DELIVERY_CANCELLED"); return NextResponse.json({success:true,event:updated,message:"Delivery cancelled. Already accepted emails cannot be recalled."}); }
    if (input.confirm !== true) throw new Error("Confirm the exact test recipient or audience and schedule before proceeding.");
    if (input.action === "test") {
      const to = typeof input.testEmail === "string" ? input.testEmail.trim().toLowerCase() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("Enter a valid test email.");
      await sendTestCampaign({to,...renderEventEmail(event,input.stage),source:"test"}); await auditEvent(s,eventId,"TEST_SENT"); return NextResponse.json({success:true,message:`Test sent to ${to}. RSVP is disabled.`});
    }
    if (input.action !== "schedule") throw new Error("Choose preview, test, schedule, or cancel.");
    const updated = await scheduleEvent(eventId,s.workspaceId,input.stage,new Date(input.scheduledAt)); await auditEvent(s,eventId,"SCHEDULED"); return NextResponse.json({success:true,event:updated,message:"Delivery schedule saved. No email was sent by this request."});
  } catch(e) { return eventError(e); }
}
