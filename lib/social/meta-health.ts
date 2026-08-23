import "server-only";
import { prisma } from "@/lib/prisma";
import { MetaApiError, testMetaConnection } from "./meta";

export async function checkMetaConnectionHealth(now=new Date()){
  const warningAt=new Date(now.getTime()+7*86_400_000);
  const connections=await prisma.socialConnection.findMany({where:{platform:{in:["FACEBOOK","INSTAGRAM"]},state:{in:["CONNECTED","CONNECTED_DIRECT_PUBLISHING_DISABLED","EXPIRING","ACTIVE"]},OR:[{lastConnectionTestAt:null},{lastConnectionTestAt:{lt:new Date(now.getTime()-12*60*60_000)}},{tokenExpiresAt:{lte:warningAt}}]},take:12});
  let healthy=0,attention=0;
  for(const connection of connections){
    if(connection.tokenExpiresAt&&connection.tokenExpiresAt<=now){await prisma.socialConnection.update({where:{id:connection.id},data:{state:"EXPIRED",directPublishingEnabled:false,lastProviderErrorCode:"TOKEN_EXPIRED",lastProviderErrorMessage:"The Meta access token expired. Reconnect before publishing."}});attention++;continue;}
    try{await testMetaConnection(connection);await prisma.socialConnection.update({where:{id:connection.id},data:{state:connection.tokenExpiresAt&&connection.tokenExpiresAt<=warningAt?"EXPIRING":connection.directPublishingEnabled?"CONNECTED":"CONNECTED_DIRECT_PUBLISHING_DISABLED",lastConnectionTestAt:now,lastConnectionTestSuccessAt:now,lastProviderErrorCode:null,lastProviderErrorMessage:null}});healthy++;}
    catch(error){const code=error instanceof MetaApiError?error.code:"CONNECTION_TEST_FAILED";await prisma.socialConnection.update({where:{id:connection.id},data:{state:["190","TOKEN_MISSING"].includes(code)?"REAUTHORIZATION_REQUIRED":"ERROR",directPublishingEnabled:false,lastConnectionTestAt:now,lastProviderErrorCode:code,lastProviderErrorMessage:error instanceof Error?error.message:"Meta connection test failed."}});attention++;}
  }
  return {inspected:connections.length,healthy,attention};
}
