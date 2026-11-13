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
    secureDatabaseOptions(env.DATABASE_URL || '',env,()=> 'CONFIGURATION_VALIDATION_ONLY');
    for(const key of ['DIRECT_URL','SUPABASE_DB_URL','POSTGRES_URL']) {
      if(env[key])secureDatabaseOptions(env[key]!,env,()=> 'CONFIGURATION_VALIDATION_ONLY');
    }
  } catch {findings.push('DATABASE_CONFIGURATION_INVALID');}
  // Return identifiers only; never values, hashes, URLs or raw validation exceptions.
  return {valid:!findings.length,findings:[...new Set(findings)],deploymentMode:'DISCOVERY_ONLY',financialExecutionAllowed:false};
}
export function requireProductionConfiguration(env: Record<string,string|undefined>) {
  const result=validateProductionConfiguration(env);
  if(!result.valid) throw Error('PRODUCTION_CONFIGURATION_REJECTED:'+result.findings.join(','));
  return result;
}
/** Reject driver overrides before pg parses the URL. No exception contains the URL. */
export function secureDatabaseOptions(raw:string,env:Record<string,string|undefined>,readCa:(path:string)=>string) {
  let url:URL;
  try {
    url=new URL(raw);
    decodeURIComponent(url.username);decodeURIComponent(url.password);decodeURI(url.pathname);
  } catch {throw Error('INVALID_DATABASE_URL');}
  if(!['postgres:','postgresql:'].includes(url.protocol)) throw Error('INVALID_DATABASE_PROTOCOL');
  if(!url.hostname || !url.username || !url.password || !url.pathname.slice(1) || url.hash ||
     /[%\\\s]/.test(url.hostname))throw Error('INVALID_DATABASE_URL');
  const production=env.NODE_ENV==='production';
  const allowed=new Set(['sslmode','ssl','sslrootcert','application_name']);
  const seen=new Set<string>();
  for(const [key] of url.searchParams) {
    if(!allowed.has(key) || seen.has(key))throw Error('DATABASE_PARAMETER_REJECTED');
    seen.add(key);
  }
  const mode=url.searchParams.get('sslmode');
  const ssl=url.searchParams.get('ssl');
  if(env.NODE_TLS_REJECT_UNAUTHORIZED==='0' || env.DATABASE_SSL_REJECT_UNAUTHORIZED==='false' ||
     (mode!==null && !['require','verify-ca','verify-full'].includes(mode)) ||
     (ssl!==null && !['true','1'].includes(ssl)))throw Error('DATABASE_TLS_REQUIRED');
  const urlCa=url.searchParams.get('sslrootcert');
  if(urlCa!==null && !urlCa)throw Error('DATABASE_CA_REQUIRED');
  if(urlCa && env.DATABASE_SSL_CA && urlCa!==env.DATABASE_SSL_CA)throw Error('DATABASE_CA_CONFLICT');
  const caPath=env.DATABASE_SSL_CA || urlCa;
  // Endpoint names and environment assertions do not authenticate a server.
  // Keep verified TLS for every production endpoint, including private networks.
  const localFixture=!production && ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  const tls=(!localFixture || env.DATABASE_SSL==='true' || Boolean(caPath) || Boolean(mode) || Boolean(ssl));
  let ca:string|undefined;
  if(caPath) {
    try {ca=readCa(caPath);if(!ca.trim())throw Error();}
    catch {throw Error('DATABASE_CA_UNAVAILABLE');}
  }
  for(const key of ['sslmode','sslrootcert','ssl'])url.searchParams.delete(key);
  return {connectionString:url.href,ssl:tls?{rejectUnauthorized:true,...(ca?{ca}:{})}:false,
    connectionTimeoutMillis:5000,query_timeout:5000,statement_timeout:5000};
}
