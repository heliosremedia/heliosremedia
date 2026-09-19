import {createHash} from 'node:crypto';
export const BASELINE='20260909000000_verified_pre_v2_baseline';
export const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
// Excludes only migration bookkeeping. Never excludes an application object.
export async function schemaSnapshot(db){
 const queries={
  relations:`SELECT c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname<>'_prisma_migrations' AND c.relkind IN ('r','p','v','m','S','f') ORDER BY 1`,
  columns:`SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) type,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid) expression FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relname<>'_prisma_migrations' AND c.relkind IN ('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1,2`,
  constraints:`SELECT c.relname,t.conname,t.contype,t.convalidated,pg_get_constraintdef(t.oid) definition FROM pg_constraint t JOIN pg_class c ON c.oid=t.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname<>'_prisma_migrations' ORDER BY 1,2`,
  indexes:`SELECT c.relname,i.relname name,pg_get_indexdef(i.oid) definition,x.indisvalid,x.indisready FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class c ON c.oid=x.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname<>'_prisma_migrations' ORDER BY 1,2`,
  triggers:`SELECT c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname<>'_prisma_migrations' ORDER BY 1,2`,
  enums:`SELECT t.typname,e.enumlabel FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder`,
  functions:`SELECT p.proname,pg_get_function_identity_arguments(p.oid) arguments,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p') ORDER BY 1,2`,
  policies:`SELECT * FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname`,
  views:`SELECT viewname,definition FROM pg_views WHERE schemaname='public' ORDER BY viewname`,
  sequences:`SELECT sequencename,data_type,start_value,min_value,max_value,increment_by,cycle,cache_size FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename`,
  extraSchemas:`SELECT nspname FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname NOT LIKE 'pg_%' ORDER BY 1`,
  eventTriggers:`SELECT evtname,evtevent,evtenabled,evttags FROM pg_event_trigger ORDER BY evtname`,
  extraTypes:`SELECT t.typname,t.typtype FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace LEFT JOIN pg_class c ON c.oid=t.typrelid WHERE n.nspname='public' AND (t.typtype IN ('d','r','m') OR (t.typtype='c' AND c.relkind='c')) ORDER BY 1`,
  extensions:`SELECT extname,extversion FROM pg_extension WHERE extname<>'plpgsql' ORDER BY 1`,
 };
 const result={};for(const [key,sql] of Object.entries(queries))result[key]=(await db.query(sql)).rows;return result;
}
export async function readLedger(db){
 const exists=(await db.query(`SELECT to_regclass('public._prisma_migrations') present`)).rows[0].present;
 return exists?(await db.query('SELECT id,migration_name,checksum,started_at,finished_at,rolled_back_at,applied_steps_count FROM "_prisma_migrations" ORDER BY started_at,id')).rows:[];
}
export function classify({ledger,schema,historical,current,manifest,baselineChecksum,pinnedHistorical={}}){
 const result=(state,track=null)=>({state,track,mayDeploy:state==='supported-historical-ledger'||state==='current-compatible-ledger',mayBaseline:state==='verified-historical-without-ledger',automaticRepair:false});
 const hasBaseline=ledger.some(r=>r.migration_name===BASELINE);
 const track=hasBaseline?'baseline':'historical';
 const expected=hasBaseline?{[BASELINE]:baselineChecksum,...Object.fromEntries(Object.entries(manifest).filter(([n])=>n.startsWith('2026091')))}:manifest;
 if(ledger.some(r=>!(r.migration_name in expected)))return result('unknown-migration');
 if(ledger.some(r=>r.checksum!==expected[r.migration_name]))return result('checksum-mismatch');
 if(ledger.some(r=>r.rolled_back_at))return result('rolled-back-history-review');
 if(ledger.some(r=>!r.finished_at))return result('incomplete-migration');
 if(ledger.some(r=>!r.started_at||!Number.isFinite(new Date(r.started_at).getTime())||!Number.isFinite(new Date(r.finished_at).getTime())||new Date(r.finished_at)<new Date(r.started_at)||!Number.isInteger(r.applied_steps_count)||r.applied_steps_count<0))return result('invalid-ledger-metadata');
 if(new Set(ledger.map(r=>r.migration_name)).size!==ledger.length)return result('duplicate-ledger-entry');
 const matches=x=>hash(schema)===hash(x);
 if(!ledger.length){if(Object.values(schema).every(v=>v.length===0))return result('clean-bootstrap-candidate');return result(matches(historical)?'verified-historical-without-ledger':pinnedHistorical&&matches(pinnedHistorical)?'historical-baseline-guards-required':'untracked-schema-review');}
 const names=ledger.map(r=>r.migration_name).sort();
 const old=Object.keys(expected).filter(n=>n< '20260910000000').sort();
 const same=xs=>JSON.stringify(names)===JSON.stringify(xs);
 if(same(Object.keys(expected).sort()))return result(matches(current)?'current-compatible-ledger':'schema-mismatch',track);
 if(same(old))return result(matches(historical)?'supported-historical-ledger':'schema-mismatch',track);
 return result('incomplete-ledger',track);
}
// Read-only, repeatable snapshot; no repair or resolve is performed here.
export async function inspect(db,reference){
 await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{const ledger=await readLedger(db),schema=await schemaSnapshot(db);const result=classify({...reference,ledger,schema});await db.query('COMMIT');return {...result,schemaHash:hash(schema),ledgerHash:hash(ledger),ledger};}catch(error){await db.query('ROLLBACK');throw error;}
}
