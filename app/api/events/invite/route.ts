import { NextResponse } from "next/server";
import { EventShareError, shareHeaders } from "@/lib/events/share-core";
import { getSharedEvent, registerSharedGuest } from "@/lib/events/share-service";
import { readEventUpdateBody } from "@/lib/events/updates-core";
function failure(error:unknown) {
  return NextResponse.json({success:false,error:error instanceof EventShareError ? error.message : "The invitation could not be processed. Please try again."},{status:error instanceof EventShareError ? error.status : 400,headers:shareHeaders});
}
export async function GET(request:Request) {
  try { return NextResponse.json({success:true,event:await getSharedEvent(request.headers.get("authorization")?.replace(/^Bearer /i,""))},{headers:shareHeaders}); } catch(error) { return failure(error); }
}
export async function POST(request:Request) {
  try { return NextResponse.json({success:true,...await registerSharedGuest(await readEventUpdateBody(request))},{headers:shareHeaders}); } catch(error) { return failure(error); }
}
