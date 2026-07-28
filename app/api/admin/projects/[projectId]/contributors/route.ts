import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";

export async function PUT(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await getAdminSession();
  if (!session || !["OWNER","ADMIN","EDITOR"].includes(session.role)) return NextResponse.json({success:false,error:"Editor access is required."},{status:403});
  const { projectId } = await context.params;
  const project = await prisma.project.findFirst({where:{id:projectId,workspaceId:session.workspaceId},select:{id:true}});
  if(!project)return NextResponse.json({success:false,error:"Project not found."},{status:404});
  const body=await request.json() as {contributors?:Array<Record<string,unknown>>};
  if(!Array.isArray(body.contributors)||body.contributors.length>30)return NextResponse.json({success:false,error:"Add no more than 30 contributors."},{status:400});
  const userIds=body.contributors.map(item=>typeof item.adminUserId==="string"?item.adminUserId:null).filter((id):id is string=>Boolean(id));
  const [users, existingCredits]=await Promise.all([
    prisma.adminUser.findMany({where:{id:{in:userIds},workspaceId:session.workspaceId},select:{id:true,displayName:true,title:true,disciplines:true,active:true}}),
    prisma.projectContributor.findMany({where:{projectId,workspaceId:session.workspaceId,adminUserId:{in:userIds}},select:{adminUserId:true,displayNameSnapshot:true,titleSnapshot:true,disciplinesSnapshot:true}}),
  ]);
  if(users.length!==new Set(userIds).size)return NextResponse.json({success:false,error:"One or more contributors are unavailable in this workspace."},{status:400});
  const existingById=new Map(existingCredits.map(credit=>[credit.adminUserId,credit]));
  if(users.some(user=>!user.active&&!existingById.has(user.id)))return NextResponse.json({success:false,error:"Deactivated accounts cannot be added as new contributors."},{status:400});
  const byId=new Map(users.map(user=>[user.id,user]));
  const rows=body.contributors.map((item,index)=>{
    const adminUserId=typeof item.adminUserId==="string"?item.adminUserId:null; const user=adminUserId?byId.get(adminUserId):null;
    const externalName=typeof item.externalName==="string"?item.externalName.trim().slice(0,120):"";
    const externalDiscipline=typeof item.externalDiscipline==="string"?item.externalDiscipline.trim().slice(0,120):"";
    if(!user&&!externalName)throw new Error("INVALID_CONTRIBUTOR");
    const existing=user?existingById.get(user.id):null;
    return {projectId,workspaceId:session.workspaceId,adminUserId:user?.id||null,displayNameSnapshot:user?.active?user.displayName:(existing?.displayNameSnapshot||user?.displayName||externalName),titleSnapshot:user?.active?user.title:(existing?.titleSnapshot||user?.title||null),disciplinesSnapshot:user?.active?user.disciplines:(existing?.disciplinesSnapshot||user?.disciplines||[externalDiscipline||"Other"]),externalName:user?null:externalName,externalDiscipline:user?null:externalDiscipline||null,public:item.public!==false,displayOrder:index};
  });
  try{
    await prisma.$transaction(async tx=>{await tx.projectContributor.deleteMany({where:{projectId,workspaceId:session.workspaceId}});if(rows.length)await tx.projectContributor.createMany({data:rows});});
    await recordAuditEvent({actorId:session.userId,actorEmail:session.email,action:"PROJECT_CONTRIBUTORS_UPDATED",entityType:"Project",entityId:projectId,summary:`Project contributor credits updated (${rows.length}).`});
    return NextResponse.json({success:true});
  }catch(error){if(error instanceof Error&&error.message==="INVALID_CONTRIBUTOR")return NextResponse.json({success:false,error:"Every external contributor needs a name."},{status:400});console.error("Unable to save project contributors:",error);return NextResponse.json({success:false,error:"Project contributors could not be saved."},{status:500});}
}
