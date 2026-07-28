import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { parseLegacyContributorIdentity } from "@/lib/contributor-identity";

export async function GET() {
  const session = await getAdminSession();
  if (!session || !["OWNER","ADMIN"].includes(session.role)) return NextResponse.json({ success:false,error:"Administrator access is required." },{status:403});
  const users = await prisma.adminUser.findMany({
    where: { workspaceId: session.workspaceId },
    select: { displayName:true,title:true,legacyDisplayName:true },
  });
  let migrated=0,unchanged=0,review=0;
  for(const user of users){
    if(user.legacyDisplayName&&user.title){migrated+=1;continue;}
    const result=parseLegacyContributorIdentity(user.displayName,user.title);
    if(result.status==="review"||result.status==="migratable")review+=1;else unchanged+=1;
  }
  return NextResponse.json({success:true,total:users.length,migrated,unchanged,review});
}
