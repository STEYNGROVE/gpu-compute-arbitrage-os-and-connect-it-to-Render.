import { createHash, verify } from 'node:crypto';
import { strictPublicationTimestamp } from '../publicationTimestamp.js';

export type EvidenceStatus = 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED' | 'EXPIRED' | 'REJECTED';
export type EvidenceKind = 'SUPPLIER' | 'CUSTOMER_IDENTITY' | 'REQUIREMENT' | 'CONTACT' | 'CONTRACT' | 'APPROVAL' | 'QUOTE' | 'INVOICE' | 'PAYMENT' | 'DELIVERY' | 'BILLING';
export interface EvidenceReceipt {
  issuer: string;
  signature: string;
  payload: {
    kind: EvidenceKind; subjectId: string; accountId: string;
    origin: 'SIMULATION' | 'MANUAL' | 'INDEPENDENT_READ_ONLY';
    sourceUrl: string; observedAt: string; expiresAt: string;
    facts: Record<string, string | number | boolean>;
  };
}
export const reference = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(v);
export const integer = (v: unknown, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
/** Flat, bounded canonical values; no caller-provided digest is trusted. */
export function canonicalFacts(input: Record<string, unknown>): string {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('INVALID_FACTS');
  const keys = Object.keys(input).sort();
  if (keys.length > 64) throw Error('EVIDENCE_TOO_LARGE');
  const entries = keys.map(key => {
    const value = input[key];
    if (key.length > 80 || typeof value === 'string' && value.length > 1000 ||
        value !== null && !['string','number','boolean'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value)) throw Error('INVALID_FACTS');
    return [key,value];
  });
  const result = JSON.stringify(entries);
  if (Buffer.byteLength(result) > 16384) throw Error('EVIDENCE_TOO_LARGE');
  return result;
}
export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
export function receiptBytes(receipt: EvidenceReceipt): string {
  const p = receipt.payload;
  return canonicalFacts({issuer:receipt.issuer,kind:p.kind,subjectId:p.subjectId,accountId:p.accountId,origin:p.origin,
    sourceUrl:p.sourceUrl,observedAt:p.observedAt,expiresAt:p.expiresAt,factsDigest:sha256(canonicalFacts(p.facts))});
}
export function safePublicReference(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') &&
      !url.search && !url.hash && !url.hostname.endsWith('.') && !url.hostname.endsWith('.localhost') &&
      !/^(localhost|\[|\d)/i.test(url.hostname) && !/\.(local|internal)$/i.test(url.hostname);
  } catch { return false; }
}
export interface ReceiptAssessment { status: EvidenceStatus; reasons: string[]; digest: string | null; signatureVerified: boolean; executionAuthorized: false }
/** Public-key trust roots are installed by reviewed server code, never supplied by an HTTP caller.
 * OFFLINE_TEST cannot establish VERIFIED, even with a mathematically valid signature.
 * A signature authenticates a collector statement, not the truth of an unreviewed collector.
 */
export class EvidenceAuthority {
  private readonly issuers: ReadonlyMap<string, { publicKeyPem: string; kinds: readonly EvidenceKind[] }>;
  constructor(issuers: ReadonlyMap<string, {publicKeyPem: string; kinds: readonly EvidenceKind[]} > = new Map(), private readonly mode: 'INDEPENDENT' | 'OFFLINE_TEST' = 'OFFLINE_TEST') {
    this.issuers = new Map([...issuers].map(([id,value]) => [id, {publicKeyPem:value.publicKeyPem,kinds:[...value.kinds]}]));
  }
  assess(receipt: EvidenceReceipt, kind: EvidenceKind, subject: string, account: string, now = Date.now(), maxAgeMs = 300000): ReceiptAssessment {
    const result = (status: EvidenceStatus, reason: string, digest: string | null = null, signatureVerified = false): ReceiptAssessment =>
      ({status,reasons:[reason],digest,signatureVerified,executionAuthorized:false});
    try {
      if (!integer(now) || !integer(maxAgeMs,86400000) || maxAgeMs < 1) return result('REJECTED','INVALID_CLOCK_POLICY');
      const p = receipt.payload;
      if (!reference(receipt.issuer) || !reference(subject) || !reference(account) || p.kind !== kind || p.subjectId !== subject || p.accountId !== account ||
          !['SIMULATION','MANUAL','INDEPENDENT_READ_ONLY'].includes(p.origin) || !safePublicReference(p.sourceUrl)) return result('REJECTED','BINDING_OR_SOURCE_INVALID');
      const observed = strictPublicationTimestamp(p.observedAt), expiry = strictPublicationTimestamp(p.expiresAt);
      if (![observed,expiry].every(Number.isFinite) || observed > now || expiry <= observed || expiry - observed > maxAgeMs) return result('REJECTED','INVALID_EVIDENCE_TIME');
      const bytes = receiptBytes(receipt), digest = sha256(bytes);
      if (expiry <= now || now - observed > maxAgeMs) return result('EXPIRED','EVIDENCE_EXPIRED',digest);
      if (p.origin === 'SIMULATION' || p.origin === 'MANUAL') return result('UNVERIFIED','NON_INDEPENDENT_ORIGIN',digest);
      const trusted = this.issuers.get(receipt.issuer);
      if (!trusted || !trusted.kinds.includes(kind)) return result('UNVERIFIED','TRUSTED_COLLECTOR_REQUIRED',digest);
      if (typeof receipt.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(receipt.signature) ||
          !verify(null,Buffer.from(bytes),trusted.publicKeyPem,Buffer.from(receipt.signature,'base64'))) return result('REJECTED','SIGNATURE_INVALID',digest);
      return result(this.mode === 'INDEPENDENT' ? 'VERIFIED' : 'PARTIALLY_VERIFIED', this.mode === 'INDEPENDENT' ? 'TRUSTED_COLLECTOR_ATTESTATION' : 'OFFLINE_SIGNATURE_ONLY',digest,true);
    } catch { return result('REJECTED','INVALID_EVIDENCE'); }
  }
}
