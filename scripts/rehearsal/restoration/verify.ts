import assert from 'node:assert/strict';
import {PrismaClient} from '../../../app/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {databaseUrl,requireDatabase} from './core.mjs';
export async function verifyRestored(name:string){
 const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:requireDatabase(databaseUrl(name))})});
 try{
  assert.deepEqual((await prisma.legalDocument.findMany({where:{workspaceId:'a'},select:{id:true}})).map(r=>r.id),['legal-a']);
  assert.equal((await prisma.siteSettings.findUniqueOrThrow({where:{workspaceId:'a'}})).id,'default');
  assert.equal(await prisma.locationPage.count({where:{slug:'same-city'}}),2);
  assert.equal(await prisma.media.count({where:{assetId:null}}),2);
  assert.equal(await prisma.workspaceAsset.count({where:{workspaceId:'a'}}),1);
  const before=await prisma.homepageProject.findUniqueOrThrow({where:{id:'hpa'}});
  const foreign=await prisma.homepageProject.findUniqueOrThrow({where:{id:'hpb'}});
  await assert.rejects(prisma.$transaction(async tx=>{
   assert.equal((await tx.homepageProject.updateMany({where:{id:'hpb',project:{workspaceId:'a'}},data:{titleOverride:'Must not cross'}})).count,0);
   assert.equal((await tx.homepageProject.updateMany({where:{id:'hpa',project:{workspaceId:'a'},updatedAt:before.updatedAt},data:{titleOverride:'Rehearsal CAS',updatedAt:new Date(before.updatedAt.getTime()+1)}})).count,1);
   assert.equal((await tx.homepageProject.updateMany({where:{id:'hpa',updatedAt:before.updatedAt},data:{titleOverride:'Stale'}})).count,0);
   throw new Error('ROLLBACK_FIXTURE_PROBE');
  }),/ROLLBACK_FIXTURE_PROBE/);
  assert.deepEqual(await prisma.homepageProject.findUnique({where:{id:'hpa'}}),before);
  assert.deepEqual(await prisma.homepageProject.findUnique({where:{id:'hpb'}}),foreign);
  await assert.rejects(prisma.workspaceAsset.update({where:{id:'retained-preparation'},data:{workspaceId:'b'}}));
  console.log('PASS generated Prisma restored database '+name+': scoped reads, conditional writes, stale/foreign rejection, transaction rollback, registry guard');
 }finally{await prisma.$disconnect();}
}
