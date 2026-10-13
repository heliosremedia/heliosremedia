import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const text=readFileSync('.github/workflows/v2-neon-staging-bootstrap.yml','utf8');
const owner=text.slice(text.indexOf('\n  initialize_owners:'));
test('adds only the named protected owner track; historical executor bytes are preserved',()=>{
 assert.ok(owner.startsWith('\n  initialize_owners:'));
 const normalized=text.slice(0,text.indexOf('\n  initialize_owners:'))
 .replace('options: [clean-bootstrap, current-baseline, current-studio-upgrade, persistent-owner-credentials]','options: [clean-bootstrap, current-baseline, current-studio-upgrade]')
 .replace('      owner_confirmation:\n        description: For persistent-owner-credentials enter initialize-two-synthetic-owner-passwords-only\n        required: false\n        type: string\n','')
 .replace("(inputs.track == 'clean-bootstrap' || inputs.track == 'current-baseline') &&","inputs.track != 'current-studio-upgrade' &&");
 assert.equal(createHash('sha1').update('blob '+Buffer.byteLength(normalized)+'\0'+normalized).digest('hex'),'192d48f1678508c4ad1128169d4b6ca265ba8b49');
});
test('pins the independently qualified source and runs without migration or deployment',()=>{
 assert.match(owner,/environment: helios-v2-staging-bootstrap/);
 assert.ok(owner.includes("github.sha == inputs.executor_sha"));
 assert.ok(owner.includes("inputs.candidate_sha == 'b4bd905041da9223ed7314d5000914addfead53d'"));
 assert.ok(owner.includes("inputs.owner_confirmation == 'initialize-two-synthetic-owner-passwords-only'"));
 assert.ok(owner.includes('ref: b4bd905041da9223ed7314d5000914addfead53d'));
 assert.ok(owner.includes("STAGING_REGRESSION_RUN: '38400798944'"));
 assert.ok(owner.includes("STAGING_OWNER_REHEARSAL_RUN: '38400798857'"));
 assert.ok(owner.includes('run: node scripts/staging/owner-live.mjs'));
 assert.ok(owner.includes('permissions')===false);
 for(const unsafe of ['migrate deploy','bootstrap.mjs','current-upgrade-live.mjs','vercel','password_hash','persist-credentials: true','pull_request_target'])assert.equal(owner.includes(unsafe),false);
});
test('credentials are protected step secrets and never dispatch inputs',()=>{
 const inputs=text.slice(0,text.indexOf('permissions:'));
 assert.equal(inputs.includes('PASSWORD'),false);
 assert.ok(owner.includes('STAGING_OWNER_PASSWORD_A: ${{ secrets.STAGING_OWNER_PASSWORD_A }}'));
 assert.ok(owner.includes('STAGING_OWNER_PASSWORD_B: ${{ secrets.STAGING_OWNER_PASSWORD_B }}'));
 assert.ok(owner.indexOf('STAGING_OWNER_PASSWORD_A:')>owner.indexOf('- name: Initialize only existing synthetic owner credentials'));
 assert.ok(owner.includes('path: staging-evidence/owner-credentials-live.json'));
});
