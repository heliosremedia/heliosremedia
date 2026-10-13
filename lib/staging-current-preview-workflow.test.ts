import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const text=readFileSync('.github/workflows/v2-vercel-staging-qualification.yml','utf8');
const current=text.slice(text.indexOf('\n  qualify_current:'));
test('historical Preview workflow is byte-preserved after removing the separate current track',()=>{
 const old=text.slice(0,text.indexOf('\n  qualify_current:'))
 .replace('      track:\n        description: Explicit Preview qualification track\n        required: false\n        default: historical-temporary\n        type: choice\n        options: [historical-temporary, current-owner-preview]\n      current_confirmation:\n        description: For current-owner-preview enter retain-current-preview-for-synthetic-owner-testing-only\n        required: false\n        type: string\n','')
 .replace("inputs.track != 'current-owner-preview' && ","");
 assert.equal(createHash('sha1').update('blob '+Buffer.byteLength(old)+'\0'+old).digest('hex'),'f6200b92222f2ff0c192a5ed94098c6b9a26360e');
});
test('current track pins source, rehearsal, integration regression and required review',()=>{
 for(const fragment of ["inputs.track == 'current-owner-preview'","github.ref == 'refs/heads/codex/v2-neon-staging-bootstrap'","github.sha == inputs.executor_sha","inputs.candidate_sha == '2f890c32d6ba627e3af49c294f15b7fb61773394'","inputs.current_confirmation == 'retain-current-preview-for-synthetic-owner-testing-only'",'environment: helios-v2-staging-bootstrap','ref: 2f890c32d6ba627e3af49c294f15b7fb61773394',"STAGING_RELEASE_RUN_ID: '38410895761'","STAGING_PREVIEW_REHEARSAL_RUN: '38409592404'",'STAGING_PREVIEW_REHEARSAL_SHA: 78fac8d545cd8ae52237dbca209176a8619530d7','run: node scripts/staging/current-preview/live.mjs','run: node scripts/staging/current-preview/live.mjs --restore-suppression'])assert.ok(current.includes(fragment));
 for(const unsafe of ['migrate deploy','current-upgrade-live.mjs','owner-live.mjs','persist-credentials: true','--prod','target: production'])assert.equal(current.includes(unsafe),false);
});
test('passwords are step-scoped environment secrets; only safe receipt is retained',()=>{
 const inputs=text.slice(0,text.indexOf('permissions:'));assert.equal(inputs.includes('PASSWORD'),false);
 assert.ok(current.indexOf('STAGING_OWNER_PASSWORD_A:')>current.indexOf('- name: One-shot current Preview'));
 assert.ok(current.includes('STAGING_OWNER_PASSWORD_A: ${{ secrets.STAGING_OWNER_PASSWORD_A }}'));
 assert.ok(current.includes('STAGING_OWNER_PASSWORD_B: ${{ secrets.STAGING_OWNER_PASSWORD_B }}'));
 assert.ok(current.includes("if: always() && hashFiles('staging-evidence/current-preview-restoration.json') != ''"));
 assert.ok(current.includes('path: staging-evidence/current-owner-preview.json'));
 assert.equal(current.includes('path: staging-evidence/\n'),false);
});
