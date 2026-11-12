import { liveOperationsAllowed } from '../simulationSafety.js';
export interface ConfigurationAssessment { valid: boolean; findings: string[]; deploymentMode:'DISCOVERY_ONLY'; financialExecutionAllowed:false }
const secretNames=['OWNER_API_KEY','CUSTOMER_API_KEY','ESCROW_SIGNING_SECRET','QUOTE_LOCK_SECRET','AUDIT_CHAIN_SECRET'] as const;
export function validateProductionConfiguration(env: Record<string,string|undefined>): ConfigurationAssessment {
  const findings:string[]=[];
  if(env.NODE_ENV!=='production') findings.push('PRODUCTION_MODE_REQUIRED');
  if(env.APP_OPERATING_MODE!=='DISCOVERY_ONLY') findings.push('EXPLICIT_DISCOVERY_MODE_REQUIRED');
  if(env.STRICT_AUTH_ENFORCEMENT!=='true') findings.push('STRICT_AUTH_REQUIRED');
  if(env.ENABLE_STUDIO_AUTH_FALLBACK==='true' || env.ALLOW_PREVIEW_SESSION==='true') findings.push('PREVIEW_AUTH_FORBIDDEN');
  if(!/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT || '')) findings.push('EXACT_REVISION_REQUIRED');
  if(env.DB_MIGRATION_EXECUTE || env.GPU_PURCHASING_ENABLED==='true' || env.GPU_EVIDENCE_VERIFIER_READY==='true' ||
     env.NODE_TLS_REJECT_UNAUTHORIZED==='0' || env.DATABASE_SSL_REJECT_UNAUTHORIZED==='false' || liveOperationsAllowed()) findings.push('UNSAFE_RELEASE_SETTING');
  const seen=new Set<string>();
  for(const name of secretNames) {
    const value=env[name];
    if(!value || value.length<32 || value.length>512 || value.trim()!==value || /^(.)\1+$/.test(value) || /example|placeholder|changeme|synthetic|test.only/i.test(value)) findings.push(name+'_INVALID');
    else {if(seen.has(value))findings.push('SECRET_REUSE_FORBIDDEN');seen.add(value);}
  }
  if(Object.keys(env).some(k=>k.startsWith('VITE_') && /SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY|DATABASE/i.test(k))) findings.push('FRONTEND_SECRET_FORBIDDEN');
  try {
    const url=new URL(env.DATABASE_URL || '');
    if(!['postgres:','postgresql:'].includes(url.protocol) || !url.username || !url.password || !url.hostname || url.hash ||
       ['disable','allow','prefer','no-verify'].includes(url.searchParams.get('sslmode') || '') ||
       ['sslkey','sslcert','uselibpqcompat'].some(k=>url.searchParams.has(k))) findings.push('DATABASE_CONFIGURATION_INVALID');
  } catch {findings.push('DATABASE_CONFIGURATION_INVALID');}
  // Return identifiers only; never values, hashes, URLs or raw validation exceptions.
  return {valid:!findings.length,findings:[...new Set(findings)],deploymentMode:'DISCOVERY_ONLY',financialExecutionAllowed:false};
}
export function requireProductionConfiguration(env: Record<string,string|undefined>) {
  const result=validateProductionConfiguration(env);
  if(!result.valid) throw Error('PRODUCTION_CONFIGURATION_REJECTED:'+result.findings.join(','));
  return result;
}
/** Normalize pg URL TLS parameters so the driver cannot replace certificate-verifying options. */
export function secureDatabaseOptions(raw:string,env:Record<string,string|undefined>,readCa:(path:string)=>string) {
  const url=new URL(raw);
  if(!['postgres:','postgresql:'].includes(url.protocol)) throw Error('INVALID_DATABASE_PROTOCOL');
  const production=env.NODE_ENV==='production';
  const mode=url.searchParams.get('sslmode');
  if(production && (env.DATABASE_SSL_REJECT_UNAUTHORIZED==='false' || ['disable','allow','prefer','no-verify'].includes(mode || '') ||
    ['sslkey','sslcert','uselibpqcompat'].some(k=>url.searchParams.has(k)))) throw Error('DATABASE_TLS_REQUIRED');
  const tls=production || env.DATABASE_SSL==='true' || Boolean(env.DATABASE_SSL_CA) || Boolean(mode) || /\.(supabase\.co|supabase\.com|neon\.tech)$/.test(url.hostname);
  for(const key of ['sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat','ssl'])url.searchParams.delete(key);
  return {connectionString:url.href,ssl:tls?{rejectUnauthorized:true,...(env.DATABASE_SSL_CA?{ca:readCa(env.DATABASE_SSL_CA)}:{})}:undefined,
    connectionTimeoutMillis:5000,query_timeout:5000,statement_timeout:5000};
}
