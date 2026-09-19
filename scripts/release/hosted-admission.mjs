import assert from 'node:assert/strict';
import {canonical,digest,verifyManifest} from './policy.mjs';

// Normalized provider boundary, deliberately synthetic-only. No network or deployment
// implementation is authorized until an isolated project and database are verified.
export async function admitHosted(input) {
 try { return await validateHosted(input); } catch {
  // Provider/assertion diagnostics can contain untrusted fields. Never propagate them.
  throw new Error("Hosted admission rejected; evidence or target could not be verified");
 }
}
async function validateHosted({role,manifest,pin,provider,now}) {
 assert.equal(provider.kind,'synthetic-provider','Live hosted adapter is not enabled');
 assert.ok(['candidate','rollback'].includes(role));
 const expected=pin.releases[role];assert.ok(expected,'Missing independently pinned release');
 assert.ok(manifest,'Missing manifest');
 verifyManifest(manifest,expected.manifest);
 assert.equal(manifest.checksum,expected.manifest.checksum);
 assert.notEqual(pin.releases.candidate.manifest.checksum,pin.releases.rollback.manifest.checksum);
 assert.notEqual(pin.releases.candidate.deploymentId,pin.releases.rollback.deploymentId);
 assert.equal(pin.target.environment,'preview');
 assert.equal(pin.target.classification,'isolated-non-production');
 assert.equal(pin.target.providerCredentials,'synthetic-only');
 assert.deepEqual(pin.target.customDomains,[]);
 assert.equal(pin.target.databaseClassification,'disposable');
 assert.ok(Number.isSafeInteger(now));
 assert.ok(now>=pin.issuedAt && now<pin.expiresAt,'Expired or future admission');
 assert.ok(pin.expiresAt-pin.issuedAt<=3600000,'Admission lifetime exceeds one hour');
 // Values come from separate provider/CI reads, not environment or deployment meta
 // supplied by the caller. A live adapter must authenticate these reads itself.
 const [target,deployment,workflow,artifact,migration]=await Promise.all([
  provider.target(pin.target.projectId),provider.deployment(expected.deploymentId),
  provider.workflow(pin.workflow.runId),provider.artifact(pin.artifact.id),
  provider.migration(pin.target.databaseId),
 ]);
 assert.equal(canonical(target),canonical(pin.target),'Target safety inventory changed');
 assert.equal(workflow.repository,'heliosremedia/heliosremedia');
 assert.equal(canonical(workflow),canonical(pin.workflow),'Workflow provenance mismatch');
 assert.equal(workflow.conclusion,'success');
 assert.equal(workflow.headSha,manifest.candidate);
 assert.equal(String(workflow.runId),manifest.run);
 assert.equal(artifact.id,pin.artifact.id);assert.equal(artifact.runId,workflow.runId);
 assert.equal(artifact.expired,false);assert.equal(artifact.digest,pin.artifact.digest);
 assert.equal(digest(artifact.manifests),artifact.digest,'Artifact contents changed');
 assert.equal(canonical(artifact.manifests[role]),canonical(manifest),'Artifact role substitution');
 assert.equal(deployment.id,expected.deploymentId);
 assert.equal(deployment.projectId,target.projectId);
 assert.equal(deployment.environment,'preview');
 assert.equal(deployment.state,'READY');assert.equal(deployment.sourceSha,manifest.sourceRevision);
 assert.equal(deployment.buildDigest,manifest.build.digest);
 assert.equal(deployment.manifestChecksum,manifest.checksum);
 assert.equal(deployment.artifactId,artifact.id);
 assert.equal(deployment.admissionId,pin.admissionId,'Build was not admitted');
 assert.deepEqual(deployment.customDomains,[]);
 assert.equal(migration.databaseId,target.databaseId);
 assert.equal(migration.checkedAt,now,'Migration evidence must be freshly read');
 assert.equal(canonical(migration.receipt),canonical(manifest.preflight),'Migration receipt mismatch');
 assert.equal(migration.identityHash,digest(manifest.identity));
 // Explicit allowlist: never serialize provider objects, raw errors or credentials.
 return {version:1,mode:'synthetic-only',role,admissionId:pin.admissionId,
  deploymentId:deployment.id,projectId:target.projectId,environment:'preview',
  candidate:manifest.candidate,sourceRevision:manifest.sourceRevision,runId:workflow.runId,
  artifactId:artifact.id,artifactDigest:artifact.digest,manifestChecksum:manifest.checksum,
  buildDigest:manifest.build.digest,migrationReceipt:digest(manifest.preflight),
  track:manifest.preflight.track,checkedAt:now};
}
