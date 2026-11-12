import { reference, safePublicReference } from './evidence.js';
import { strictPublicationTimestamp } from '../publicationTimestamp.js';
export interface DiscoverySource { feedUrl:string; termsReference:string|null; reviewerReference:string|null; configurationStatus:'REVIEWED_CONFIGURATION_ONLY'|'LEGACY_UNVERIFIED'; expiresAt:string|null }
/** Administrative configuration only, not a publisher verification claim. Invalid registries fail closed. */
export function configuredDiscoverySources(registry: string | undefined, legacy: string, now=Date.now()): DiscoverySource[] {
  if (registry===undefined) return legacy.split(',').map(v=>v.trim()).filter(Boolean).slice(0,5).map(feedUrl=>({feedUrl,termsReference:null,reviewerReference:null,configurationStatus:'LEGACY_UNVERIFIED',expiresAt:null}));
  if (Buffer.byteLength(registry)>16384 || !Number.isSafeInteger(now)) throw Error('INVALID_SOURCE_REGISTRY');
  let records:unknown;try {records=JSON.parse(registry);}catch {throw Error('INVALID_SOURCE_REGISTRY');}
  if (!Array.isArray(records) || records.length>5) throw Error('INVALID_SOURCE_REGISTRY');
  const seen=new Set<string>();
  return records.map(record=>{
    if (!record || typeof record!=='object' || Array.isArray(record) || Object.keys(record).some(k=>!['feedUrl','termsReference','reviewerReference','reviewedAt','expiresAt'].includes(k))) throw Error('INVALID_SOURCE_REGISTRY');
    const {feedUrl,termsReference,reviewerReference,reviewedAt,expiresAt}=record;
    const observed=typeof reviewedAt==='string'?strictPublicationTimestamp(reviewedAt):NaN;
    const expiry=typeof expiresAt==='string'?strictPublicationTimestamp(expiresAt):NaN;
    if (typeof feedUrl!=='string' || !safePublicReference(feedUrl) || typeof termsReference!=='string' || !safePublicReference(termsReference) ||
        !reference(reviewerReference) || !Number.isFinite(observed) || !Number.isFinite(expiry) || observed>now || expiry<=now || expiry<=observed || expiry-observed>30*86400000) throw Error('INVALID_SOURCE_REGISTRY');
    const canonical=new URL(feedUrl).href;if(seen.has(canonical))throw Error('DUPLICATE_SOURCE_REGISTRY');seen.add(canonical);
    return {feedUrl:canonical,termsReference,reviewerReference,configurationStatus:'REVIEWED_CONFIGURATION_ONLY' as const,expiresAt};
  });
}
