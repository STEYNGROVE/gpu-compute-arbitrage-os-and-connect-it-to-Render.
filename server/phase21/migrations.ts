import type { PoolClient } from 'pg';
import {sha256} from '../phase20/evidence.js';
export interface MigrationSource {version:string;checksum:string;proposal:boolean}
export function migrationSource(version:string,sql:string,proposal=false):MigrationSource {
  if(!/^[0-9][A-Za-z0-9_]{5,100}$/.test(version)||!sql.trim())throw Error('INVALID_MIGRATION_SOURCE');
  return {version,checksum:sha256(sql.trim()),proposal};
}
/** Planning only. Does not accept a connection, execute SQL or bless an invented baseline. */
export function planMigrations(sources:MigrationSource[],history:{version:string;checksum:string}[]) {
  const findings:string[]=[];
  const ordered=sources.filter(s=>!s.proposal).sort((a,b)=>a.version.localeCompare(b.version));
  const all=new Map<string,MigrationSource>();
  for(const source of sources){if(all.has(source.version)||!/^[a-f0-9]{64}$/.test(source.checksum))findings.push('INVALID_OR_DUPLICATE_SOURCE');all.set(source.version,source);}
  const applied=new Map<string,string>();
  for(const row of history){if(applied.has(row.version))findings.push('DUPLICATE_HISTORY');applied.set(row.version,row.checksum);
    const source=all.get(row.version);if(!source || source.proposal)findings.push('UNKNOWN_APPLIED_VERSION');else if(source.checksum!==row.checksum)findings.push('CHECKSUM_MISMATCH');}
  let missing=false;
  for(const source of ordered){if(!applied.has(source.version))missing=true;else if(missing)findings.push('NON_PREFIX_HISTORY');}
  if(!history.length)findings.push('TRUSTED_BASELINE_REQUIRED');
  return {compatible:!findings.length,findings:[...new Set(findings)],pending:ordered.filter(s=>!applied.has(s.version)).map(s=>s.version),
    proposals:sources.filter(s=>s.proposal).map(s=>s.version),executionAllowed:false,manifestSha256:sha256(JSON.stringify(ordered))};
}
export async function inspectApplicationSchema(client:Pick<PoolClient,'query'>) {
  // Column names/types matter: table existence alone is not application compatibility.
  const result=await client.query(`SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name IN ('acquisition_leads','phase20_simulation_requests','phase20_simulation_events')`);
  const expected:Record<string,Record<string,string>>={
    acquisition_leads:{id:'text',title:'text',source_url:'text',source_feed:'text',description:'text',published_at:'timestamp with time zone',discovered_at:'timestamp with time zone',status:'text'},
    phase20_simulation_requests:{id:'text',request_digest:'text',request_payload:'jsonb',max_cost_cents:'integer',execution_authorized:'boolean'},
    phase20_simulation_events:{request_id:'text',sequence:'integer',event_hash:'text'}
  };
  const missing:string[]=[];
  for(const [table,columns] of Object.entries(expected))for(const [column,type] of Object.entries(columns))if(!result.rows.some(r=>r.table_name===table&&r.column_name===column&&r.data_type===type))missing.push(table+'.'+column);
  return {compatible:!missing.length,missing,executionAllowed:false};
}
export function rollbackAssessment(input:{artifactRetained:boolean;previousRevision:string;currentSchemaCompatible:boolean;externalEffectsReconciled:boolean;backupRestoreRehearsed:boolean}) {
  const requirements=['artifactRetained','currentSchemaCompatible','externalEffectsReconciled','backupRestoreRehearsed'] as const;
  const missing=requirements.filter(k=>input[k]!==true).map(k=>String(k));
  if(!/^[a-f0-9]{40}$/.test(input.previousRevision))missing.push('exactPreviousRevision');
  return {eligibleForHumanReview:!missing.length,missing,rollbackExecutionAllowed:false,databaseReversalPerformed:false};
}
