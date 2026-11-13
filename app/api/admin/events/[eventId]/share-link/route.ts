import { NextResponse } from "next/server";
import { eventAdmin } from "@/lib/events/service";
import { EventShareError, shareHeaders } from "@/lib/events/share-core";
import { getOrCreateEventShareLink } from "@/lib/events/share-service";
export async function POST(_request:Request,ctx:{params:Promise<{eventId:string}>}) {
  try {
    const session = await eventAdmin();
    const url = await getOrCreateEventShareLink((await ctx.params).eventId,session.workspaceId);
    return NextResponse.json({success:true,url},{headers:shareHeaders});
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "Administrator access required.";
    return NextResponse.json({success:false,error:forbidden ? "Administrator access required." : error instanceof EventShareError ? error.message : "The invite link could not be created. Please try again."},{status:forbidden ? 403 : error instanceof EventShareError ? error.status : 500,headers:shareHeaders});
  }
}
