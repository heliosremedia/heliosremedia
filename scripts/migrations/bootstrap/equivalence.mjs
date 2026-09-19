import assert from 'node:assert/strict';
export const HISTORICAL_CHECKS=['NewsletterSeries_send_schedule_check','NewsletterSeries_generation_schedule_check','NewsletterSeries_send_time_check','SocialSeries_interval_check','SocialSeries_day_of_week_check','SocialSeries_day_of_month_check','SocialSeries_local_time_check'];
export const HISTORICAL_INDEX='VideoComparisonPlacement_one_featured_per_offering';
export function withoutHistoricalGuards(schema){const s=structuredClone(schema);s.constraints=s.constraints.filter(c=>!HISTORICAL_CHECKS.includes(c.conname));s.indexes=s.indexes.filter(c=>c.name!==HISTORICAL_INDEX);return s;}
export function verifyPrismaModel(migrated,model){
 const s=withoutHistoricalGuards(migrated);
 const checks=['NewsletterDeliveryAttempt_batchNumber_check','NewsletterDeliveryAttempt_check','NewsletterDeliveryAttempt_executionVersion_check','NewsletterDeliveryAttempt_payloadHash_check','NewsletterDeliveryAttempt_recipientIds_check','WorkspaceAsset_byteSize_check'];
 assert.equal(s.constraints.filter(c=>checks.includes(c.conname)).length,6);s.constraints=s.constraints.filter(c=>!checks.includes(c.conname));
 for(const name of ['LegalDocument_legacy_type_guard','WorkspaceDomain_one_primary_per_purpose_key']){assert.ok(s.indexes.some(c=>c.name===name));s.indexes=s.indexes.filter(c=>c.name!==name);}
 // PostgreSQL truncates the historical explicit identifier differently from Prisma's generated name.
 for(const i of s.indexes)if(i.name==='Testimonial_workspaceId_sourceProvider_published_displayOrder_i'){const old=i.name;i.name='Testimonial_workspaceId_sourceProvider_published_displayOrd_idx';i.definition=i.definition.replace(old,i.name);}
 assert.deepEqual(s.triggers.map(t=>t.tgname).sort(),['NewsletterDeliveryAttempt_identity_guard','WorkspaceAsset_identity_guard']);s.triggers=[];
 assert.deepEqual(s.functions.map(f=>f.proname).sort(),['guardNewsletterDeliveryAttempt','preserve_workspace_asset_identity']);s.functions=[];
 assert.deepEqual(s,model,'Only enumerated database-only guards and the known index-name difference may differ from Prisma');
}
