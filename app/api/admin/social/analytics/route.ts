import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { queueAnalyticsRefresh } from "@/lib/social/analytics";
const clean=(value:unknown,max=120)=>typeof value==="string"?value.trim().slice(0,max):"";
export async function POST(request:Request){
 const session=await getAdminSession();if(!session||!["OWNER","ADMIN"].includes(session.role))return NextResponse.json({success:false,error:"Unauthorized"},{status:401});
 const body=await request.json() as Record<string,unknown>;if(body.action!=="refresh")return NextResponse.json({success:false,error:"Unsupported action."},{status:400});
 const connectionId=clean(body.connectionId);const connection=await prisma.socialConnection.findUnique({where:{id:connectionId},select:{id:true,state:true}});
 if(!connection)return NextResponse.json({success:false,error:"Connection not found."},{status:404});if(!["CONNECTED","CONNECTED_DIRECT_PUBLISHING_DISABLED"].includes(connection.state))return NextResponse.json({success:false,error:"Connect or reauthorize this account before refreshing analytics."},{status:409});
 const days=Math.max(1,Math.min(90,Number(body.days)||30));const end=new Date();await queueAnalyticsRefresh(connection.id,new Date(end.getTime()-days*86_400_000),end);
 return NextResponse.json({success:true,message:"Analytics refresh queued. Publishing will continue independently."});
}
