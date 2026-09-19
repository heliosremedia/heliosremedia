import {digest} from './policy.mjs';
// This is a test provider, not a Vercel API implementation or hosted attestation.
export function hostedFixture(candidate,rollback,now=1000000) {
 const manifests={candidate,rollback};
 const target={projectId:'synthetic-project',environment:'preview',classification:'isolated-non-production',providerCredentials:'synthetic-only',customDomains:[],databaseClassification:'disposable',databaseId:'synthetic-database'};
 const workflow={repository:'heliosremedia/heliosremedia',runId:candidate.run,headSha:candidate.candidate,conclusion:'success',path:'.github/workflows/v2-hosted-admission.yml'};
 const artifact={id:'synthetic-artifact',runId:workflow.runId,expired:false,digest:digest(manifests),manifests};
 const releases=Object.fromEntries(Object.entries(manifests).map(([role,manifest])=>[role,{manifest,deploymentId:'synthetic-'+role}]));
 const deployments=Object.fromEntries(Object.entries(releases).map(([role,{manifest,deploymentId}])=>[deploymentId,{id:deploymentId,projectId:target.projectId,environment:'preview',state:'READY',sourceSha:manifest.sourceRevision,buildDigest:manifest.build.digest,manifestChecksum:manifest.checksum,artifactId:artifact.id,admissionId:'synthetic-admission',customDomains:[],role}]));
 const migration={databaseId:target.databaseId,checkedAt:now,receipt:candidate.preflight,identityHash:digest(candidate.identity)};
 const pin=structuredClone({target,workflow,artifact:{id:artifact.id,digest:artifact.digest},releases,admissionId:'synthetic-admission',issuedAt:now,expiresAt:now+60000});
 const provider={kind:'synthetic-provider',target:async()=>target,deployment:async id=>deployments[id],workflow:async()=>workflow,artifact:async()=>artifact,migration:async()=>migration};
 return {pin,provider,target,workflow,artifact,deployments,migration,now};
}
