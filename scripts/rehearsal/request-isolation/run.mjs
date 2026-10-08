import { qualifyWorkspaceLifecycleAdmission } from "./workspace-lifecycle-admission.mjs";
import { qualifyWorkspaceLifecycle } from "./workspace-lifecycle.mjs";
import { qualifySettingsAttachments } from "./settings-attachments.mjs";
import { qualifyFeaturedFilm } from "./featured-film.mjs";
import { qualifySupportDiagnostics } from "./support-diagnostics.mjs";
import { qualifyAboutPage } from "./about-page.mjs";
import { qualifyTeamMemberReorder } from "./team-member-reorder.mjs";
import { qualifyTeamMemberDelete } from "./team-member-delete.mjs";
import { qualifyTeamMemberWrite } from "./team-member-write.mjs";
import { qualifyPhotoComparison } from "./photo-comparison.mjs";
import { qualifyTrustedLogoStatus } from "./trusted-logo-status.mjs";
import { qualifyTrustedLogoReorder } from "./trusted-logo-reorder.mjs";
import { qualifyTrustedLogoDelete } from "./trusted-logo-delete.mjs";
import { qualifyTrustedLogoWrite } from "./trusted-logo-write.mjs";
import { qualifyTestimonialWrite } from "./testimonial-write.mjs";
import { qualifyTestimonialDelete } from "./testimonial-delete.mjs";
import { qualifyTestimonialReorder } from "./testimonial-reorder.mjs";
import { qualifyTestimonialStatus } from "./testimonial-status.mjs";
import { qualifyMediaDelete } from "./media-delete.mjs";
import { qualifyMediaPresentation } from "./media-presentation.mjs";
import { qualifyMediaCollection } from "./media-collection.mjs";
import { qualifyMediaUpdateAsset } from "./media-update-asset.mjs";
import { qualifyStreamAttachment } from "./stream-attachment.mjs";
import { qualifyProjectImageAttachment } from "./project-image-attachment.mjs";
import { qualifyStreamUploadAdmission } from "./stream-upload-admission.mjs";
import { qualifyStorageDiagnostic } from "./storage-diagnostic.mjs";
import { qualifySeriesCalendar } from "./series-calendar.mjs";
import { qualifyProjectUploadAdmission } from "./project-upload-admission.mjs";
import { qualifyBrandUploadAdmission } from "./brand-upload-admission.mjs";
import { qualifyMonitorContainment } from "./monitor-containment.mjs";
import { qualifyReferralConsent } from "./referral-consent.mjs";
import { qualifyReferralPreparation } from "./referral-preparation.mjs";
import { qualifyConsentAnalytics } from "./consent-analytics.mjs";
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readdir, readFile, writeFile, symlink, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { build } from 'esbuild';
import { DATABASE, requireDatabase, requireOrigin } from './safety.mjs';
import { qualify } from './http.mjs';
import { qualifyNewsletterConsent } from './newsletter-consent.mjs';
import { qualifyCampaignConsent } from './campaign-consent.mjs';
import { qualifyConsentDirectory } from './consent-directory.mjs';
import { qualifyPublicConsent } from './consent-public.mjs';
import { qualifyDeliveryConsent } from './delivery-consent.mjs';
import { qualifyConsentTokens } from './consent-tokens.mjs';
import { qualifyConsentAdapters } from './consent-adapters.mjs';
import { qualifyConsentSchema } from './consent-schema.mjs';
import { qualifyConsentAdmin } from './consent-admin.mjs';
import { qualifySocialAiRequestIds } from './social-ai-request-ids.mjs';
import { qualifySocialAiProviderFailure } from './social-ai-provider-failure.mjs';
import { qualifySocialAiRollback } from './social-ai-rollback.mjs';
import { qualifySocialAi } from './social-ai.mjs';
import { qualifyPortfolio } from './portfolio.mjs';
import { qualifyPreviewFencing } from './preview-fencing.mjs';
import { qualifyWebhook, WEBHOOK_KEY } from './webhook.mjs';

const root = process.cwd();
const prepareOnly = process.argv[2] === '--prepare-only';
assert.ok(process.argv.length === (prepareOnly ? 3 : 2));
requireDatabase(process.env.PACKET19_DATABASE_URL);
const noEnvironments = async dir => assert.equal((await readdir(dir)).filter(name => /^\.env(?:\.|$)/.test(name) && name !== '.env.example').length, 0, 'Runtime environment files forbidden');
await noEnvironments(root);
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!prepareOnly) execFileSync('git', ['diff', '--quiet', 'HEAD', '--'], { stdio: 'ignore' });
const scratch = await mkdtemp(join(tmpdir(), 'helios-packet19-'));
const app = join(scratch, 'app');
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, CI: process.env.CI,
  NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: DATABASE, DIRECT_URL: DATABASE, PACKET19_DATABASE_URL: DATABASE,
  STUDIO_V2_WORKSPACE_LIFECYCLE_ENABLED: 'true', STUDIO_V2_SUPPORT_DIAGNOSTICS_ENABLED: 'true', AUTH_SECRET: 'packet19-synthetic-isolated-session-secret-only', STUDIO_V2_TENANT_CONTEXT_ENABLED: 'true',
  CLOUDFLARE_STREAM_ACCOUNT_ID: 'packet58-synthetic-account',
  R2_ACCOUNT_ID: 'synthetic', R2_ACCESS_KEY_ID: 'synthetic', R2_SECRET_ACCESS_KEY: 'synthetic', R2_BUCKET_NAME: 'synthetic',
  R2_PUBLIC_URL: 'http://127.0.0.1:1/assets', NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1', LEGACY_PUBLIC_HOSTS: 'never.example.test',
  RESEND_WEBHOOK_SECRET: `whsec_${WEBHOOK_KEY}` };
let child, driver, logs = '';
async function command(executable, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const process = spawn(executable, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] }); let output = '';
    const append = chunk => { output = (output + chunk).slice(-12000); };
    process.stdout.on('data', append); process.stderr.on('data', append);
    process.on('error', reject); process.on('close', code => code === 0 ? resolve(output) : reject(new Error(`Isolated command failed (${code}): ${output}`)));
  });
}
async function prepare() {
  await mkdir(app);
  // Archive only the exact committed source. Extract into a disposable directory.
  await new Promise((resolve, reject) => {
    const archive = spawn('git', ['archive', head], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const extract = spawn('tar', ['-x', '-C', app], { env, stdio: ['pipe', 'ignore', 'pipe'] }); archive.stdout.pipe(extract.stdin);
    Promise.all([archive, extract].map(p => new Promise((done, fail) => { p.on('error', fail); p.on('close', code => code === 0 ? done() : fail(new Error('Source archive failed'))); }))).then(resolve, reject);
  });
  await noEnvironments(app);
  await symlink(join(root, 'node_modules'), join(app, 'node_modules'), 'dir');
  await symlink(join(root, 'node_modules'), join(scratch, 'node_modules'), 'dir');
  await cp(join(root, 'app/generated'), join(app, 'app/generated'), { recursive: true });
  // Explicit rehearsal substitutions only: local PostgreSQL transport and offline fonts.
  await writeFile(join(app, 'lib/prisma.ts'), `import {PrismaPg} from '@prisma/adapter-pg';import {PrismaClient} from '@/app/generated/prisma/client';export const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL!})});`);
  const layout = await readFile(join(app, 'app/layout.tsx'), 'utf8');
  const fontImport = 'import { Cormorant_Garamond, Inter } from "next/font/google";';
  assert.ok(layout.includes(fontImport), 'Font substitution must match reviewed source');
  await writeFile(join(app, 'app/layout.tsx'), layout.replace(fontImport, 'const Cormorant_Garamond = (_options: unknown) => ({variable:""}); const Inter = (_options: unknown) => ({variable:""});'));
  // Only this route receives a lexical fetch substitute. It cannot call a provider.
  const aiRoutePath = join(app, 'app/api/admin/social/ai/route.ts');
  const aiRoute = await readFile(aiRoutePath, 'utf8');
  assert.equal((aiRoute.match(/await fetch\(/g) || []).length, 2, 'Review changed provider call sites');
  assert.ok(!aiRoute.includes('syntheticSocialFetch'));
  const keyRead = 'const apiKey = process.env.OPENAI_API_KEY?.trim();';
  assert.equal(aiRoute.split(keyRead).length, 2, 'Review changed provider key read');
  await cp(join(root, 'scripts/rehearsal/request-isolation/social-provider.ts'), join(app, 'lib/packet34-social-provider.ts'));
  await writeFile(aiRoutePath, 'import { syntheticSocialFetch as fetch } from "@/lib/packet34-social-provider";\n' + aiRoute.replace(keyRead, "const apiKey = 'packet34-synthetic-no-provider';"));
  // The dashboard's global monitor is deliberately configured with a no-network
  // synthetic account so a missing containment guard produces visible evidence.
  const monitorPath = join(app, 'lib/uptimerobot.ts');
  const monitorSource = await readFile(monitorPath, 'utf8');
  const monitorKeyRead = 'const key = process.env.UPTIMEROBOT_API_KEY?.trim();';
  assert.equal(monitorSource.split(monitorKeyRead).length, 2, 'Review changed monitor credential read');
  assert.ok(!monitorSource.includes('syntheticMonitorFetch'));
  await cp(join(root, 'scripts/rehearsal/request-isolation/monitor-provider.ts'), join(app, 'lib/packet52-monitor-provider.ts'));
  await writeFile(monitorPath, 'import { syntheticMonitorFetch as fetch } from "@/lib/packet52-monitor-provider";\n' + monitorSource.replace(monitorKeyRead, "const key = 'packet52-synthetic-monitor-key';"));
  const diagnosticPath = join(app, 'app/api/admin/r2/verify/route.ts');
  const diagnosticSource = await readFile(diagnosticPath, 'utf8');
  const diagnosticImport = 'await import("@/lib/r2")';
  assert.equal(diagnosticSource.split(diagnosticImport).length, 2, 'Review changed diagnostic provider import');
  await cp(join(root, 'scripts/rehearsal/request-isolation/storage-diagnostic-provider.ts'), join(app, 'lib/packet57-storage-diagnostic-provider.ts'));
  await writeFile(diagnosticPath, diagnosticSource.replace(diagnosticImport, 'await import("@/lib/packet57-storage-diagnostic-provider")'));
  const imagePath = join(app, 'app/api/admin/projects/[projectId]/media/route.ts');
  const imageSource = await readFile(imagePath, 'utf8');
  const imageImport = 'import { r2Client, r2Config } from "@/lib/r2";';
  assert.equal(imageSource.split(imageImport).length, 2);
  assert.equal((imageSource.match(/r2Client.send\(/g) || []).length, 1);
  await cp(join(root, 'scripts/rehearsal/request-isolation/project-image-provider.ts'), join(app, 'lib/packet60-project-image-provider.ts'));
  await writeFile(imagePath, imageSource.replace(imageImport, 'import { r2Config } from "@/lib/r2";\nimport { syntheticImageClient as r2Client } from "@/lib/packet60-project-image-provider";'));
  const brandImagePath = join(app, 'lib/content-image-storage.ts');
  const brandImageSource = await readFile(brandImagePath, 'utf8');
  assert.equal(brandImageSource.split(imageImport).length, 2);
  assert.equal((brandImageSource.match(/r2Client.send\(/g) || []).length, 2);
  await cp(join(root, 'scripts/rehearsal/request-isolation/brand-image-provider.ts'), join(app, 'lib/packet72-brand-image-provider.ts'));
  await writeFile(brandImagePath, brandImageSource.replace(imageImport, 'import { r2Config } from "@/lib/r2";\nimport { syntheticBrandImageClient as r2Client } from "@/lib/packet72-brand-image-provider";'));
  const streamPath = join(app, 'app/api/admin/projects/[projectId]/stream-upload/route.ts');
  const streamSource = await readFile(streamPath, 'utf8');
  const streamAccount = 'const accountId = process.env.CLOUDFLARE_STREAM_ACCOUNT_ID?.trim();';
  const streamToken = 'const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim();';
  assert.equal(streamSource.split(streamAccount).length, 2); assert.equal(streamSource.split(streamToken).length, 2);
  assert.equal((streamSource.match(/await fetch\(/g) || []).length, 1);
  await cp(join(root, 'scripts/rehearsal/request-isolation/stream-provider.ts'), join(app, 'lib/packet58-stream-provider.ts'));
  await writeFile(streamPath, 'import { syntheticStreamFetch as fetch } from "@/lib/packet58-stream-provider";\n' + streamSource.replace(streamAccount, "const accountId = 'packet58-synthetic-account';").replace(streamToken, "const apiToken = 'packet58-synthetic-token';"));
  const bundle = join(scratch, 'driver.mjs');
  await build({ entryPoints: [join(root, 'scripts/rehearsal/request-isolation/driver.ts')], outfile: bundle, bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [{
    // The driver runs as Node, outside Next's server condition. This removes
    // only the package's build-time sentinel; application guards are unchanged.
    name: 'rehearsal-server-only', setup(build) {
      build.onResolve({ filter: /^server-only$/ }, () => ({ path: 'server-only', namespace: 'rehearsal-server-only' }));
      build.onLoad({ filter: /.*/, namespace: 'rehearsal-server-only' }, () => ({ contents: 'export {};', loader: 'js' }));
    },
  }] });
  return bundle;
}
try {
  const bundle = await prepare();
  if (prepareOnly) console.log('PASS isolated source preparation and driver bundle; database/server not executed');
  else {
    // Parent driver receives only the fixed synthetic settings it consumes.
    process.env.PACKET19_DATABASE_URL = DATABASE; process.env.AUTH_SECRET = env.AUTH_SECRET; process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED = "true"; process.env.STUDIO_V2_WORKSPACE_LIFECYCLE_ENABLED = "true";
    driver = await import(pathToFileURL(bundle));
    await driver.requireEmpty();
    await command(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push'], app);
    await driver.seed(); const schemaBefore = await driver.schemaFingerprint();
    const indexesBefore = await driver.schemaIndexFingerprint();
    console.log('PASS empty disposable database admission and synthetic two-tenant seed');
    console.log((await command(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], app)).slice(-1000));
    const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: app, env: { ...env, NODE_ENV: 'production' }, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const append = chunk => { logs = (logs + chunk).slice(-12000); }; child.stdout.on('data', append); child.stderr.on('data', append);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Next start timeout')), 90000);
      const ready = () => { if (/Ready in/.test(logs)) { clearTimeout(timer); child.stdout.off('data', ready); resolve(); } };
      child.stdout.on('data', ready); child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Next exited ${code}`)); });
    });
    const origin = requireOrigin(`http://127.0.0.1:${port}`);
    const result = await qualify(origin, driver);
    const portfolio = await qualifyPortfolio(origin, driver);
    const previewFencing = await qualifyPreviewFencing(origin, driver);
    const webhook = await qualifyWebhook(origin, driver);
    const socialAi = await qualifySocialAi(origin, driver);
    const socialAiRollback = await qualifySocialAiRollback(origin, driver);
    const socialAiProviderFailure = await qualifySocialAiProviderFailure(origin, driver);
    const socialAiRequestIds = await qualifySocialAiRequestIds(origin, driver);
    const consentSchema = await qualifyConsentSchema(driver);
    const consentAdmin = await qualifyConsentAdmin(origin, driver);
    const consentAdapters = await qualifyConsentAdapters(driver);
    const consentTokens = await qualifyConsentTokens(driver);
    const deliveryConsent = await qualifyDeliveryConsent(driver);
    const publicConsent = await qualifyPublicConsent(origin, driver);
    const newsletterConsent = await qualifyNewsletterConsent(driver);
    const campaignConsent = await qualifyCampaignConsent(driver);
    const consentDirectory = await qualifyConsentDirectory(origin, driver);
    const consentAnalytics = await qualifyConsentAnalytics(driver);
    const referralPreparation = await qualifyReferralPreparation(driver);
    const referralConsent = await qualifyReferralConsent(origin, driver);
    const monitorContainment = await qualifyMonitorContainment(origin, driver);
    const brandUploadAdmission = await qualifyBrandUploadAdmission(origin, driver);
    const emailUploadAdmission = await qualifyBrandUploadAdmission(origin, driver, "email-campaign");
    const projectUploadAdmission = await qualifyProjectUploadAdmission(origin, driver);
    const seriesCalendar = await qualifySeriesCalendar(origin, driver);
    const storageDiagnostic = await qualifyStorageDiagnostic(origin, driver);
    const streamUploadAdmission = await qualifyStreamUploadAdmission(origin, driver);
    const projectImageAttachment = await qualifyProjectImageAttachment(origin, driver);
    const streamAttachment = await qualifyStreamAttachment(origin, driver);
    const externalMediaCreation = await qualifyStreamAttachment(origin, driver, "external");
    const mediaUpdateAsset = await qualifyMediaUpdateAsset(origin, driver);
    const mediaCollection = await qualifyMediaCollection(origin, driver);
    const mediaPresentation = await qualifyMediaPresentation(origin, driver);
    const mediaDelete = await qualifyMediaDelete(origin, driver);
    const testimonialStatus = await qualifyTestimonialStatus(origin, driver);
    const testimonialReorder = await qualifyTestimonialReorder(origin, driver);
    const testimonialDelete = await qualifyTestimonialDelete(origin, driver);
    const testimonialWrite = await qualifyTestimonialWrite(origin, driver);
    const trustedLogoStatus = await qualifyTrustedLogoStatus(origin, driver);
    const trustedLogoReorder = await qualifyTrustedLogoReorder(origin, driver);
    const trustedLogoDelete = await qualifyTrustedLogoDelete(origin, driver);
    const trustedLogoWrite = await qualifyTrustedLogoWrite(origin, driver);
    const photoComparison = await qualifyPhotoComparison(origin, driver);
    const teamMemberReorder = await qualifyTeamMemberReorder(origin, driver);
    const teamMemberDelete = await qualifyTeamMemberDelete(origin, driver);
    const teamMemberWrite = await qualifyTeamMemberWrite(origin, driver);
    const aboutPage = await qualifyAboutPage(origin, driver);
    const supportDiagnostics = await qualifySupportDiagnostics(origin, driver);
    const featuredFilm = await qualifyFeaturedFilm(origin, driver);
    const settingsAttachments = await qualifySettingsAttachments(origin, driver);
    const workspaceLifecycle = await qualifyWorkspaceLifecycle(driver);
    const workspaceLifecycleAdmission = await qualifyWorkspaceLifecycleAdmission(origin, driver);


    assert.equal(await driver.schemaFingerprint(), schemaBefore);
    assert.equal(await driver.schemaIndexFingerprint(), indexesBefore);
    assert.equal(await driver.prisma.workspace.count(), 2);
    assert.equal(await driver.prisma.workspaceMembership.count({ where: { status: 'ACTIVE' } }), 2);
    assert.equal(await driver.prisma.adminUser.count({ where: { sessionVersion: 1 } }), 2);
    await mkdir('release-evidence', { recursive: true });
    await writeFile('release-evidence/request-isolation.json', JSON.stringify({ version: 1, candidate: head, runtime: 'Next build/start with PrismaPg',
      target: 'disposable-local-postgresql', sourceSubstitutions: ['PrismaNeon to PrismaPg', 'offline font variables', 'Social AI fetch to synthetic no-network provider', 'UptimeRobot fetch to synthetic no-network monitor', 'R2 diagnostic import to synthetic no-network provider', 'Stream provisioning fetch to synthetic no-network provider', 'Project media HeadObject to synthetic no-network provider', 'Brand content HeadObject to synthetic no-network provider', 'server-only build sentinel removed in Node qualification driver'], result, portfolio, previewFencing,
      webhook, socialAi, socialAiRollback, socialAiProviderFailure, socialAiRequestIds, consentAdmin, consentSchema, consentAdapters, consentTokens, deliveryConsent, publicConsent, consentDirectory, campaignConsent, newsletterConsent, consentAnalytics, referralPreparation, referralConsent, monitorContainment, brandUploadAdmission, emailUploadAdmission, projectUploadAdmission, seriesCalendar, storageDiagnostic, streamUploadAdmission, projectImageAttachment, streamAttachment, externalMediaCreation, mediaUpdateAsset, mediaCollection, mediaPresentation, mediaDelete, testimonialStatus, testimonialReorder, testimonialDelete, testimonialWrite, trustedLogoStatus, trustedLogoReorder, trustedLogoDelete, trustedLogoWrite, photoComparison, teamMemberReorder, teamMemberDelete, teamMemberWrite, aboutPage, supportDiagnostics, featuredFilm, settingsAttachments, workspaceLifecycle, workspaceLifecycleAdmission, schemaColumnsUnchanged: true, schemaIndexesUnchanged: true, syntheticAccessRestored: true, hosted: false, deployable: false }, null, 2) + '\n');
    console.log('PASS actual Next production-mode HTTP: alternating/concurrent tenants, post-write reads, foreign/stale write rejection, membership/session revocation and schema/access postflight');
    console.log('PASS both-direction portfolio published/draft/preview isolation, actual preview creation/revocation, expiry and rejected usage-write containment');
    console.log('PASS actual PostgreSQL lock-observed preview create/revoke: membership revoked after initial session, both tenants reject403 without preview/audit mutation');
  }
} catch (error) { console.error(logs); throw error; }
finally {
  if (child?.exitCode === null) {
    process.kill(-child.pid, 'SIGTERM');
    await new Promise(resolve => { child.once('exit', resolve); setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} resolve(); }, 5000).unref(); });
  }
  await driver?.prisma.$disconnect(); await rm(scratch, { recursive: true, force: true });
}
