import { EvidenceAuthority, integer, type EvidenceReceipt, type EvidenceStatus } from './evidence.js';
export type SupplierId = 'vast_ai' | 'runpod';
export const supplierCapabilities = Object.freeze({
  vast_ai: Object.freeze({identity:true,balance:true,catalog:true,capacityReservation:false,autoChargeProof:false,provision:false,cancel:false}),
  runpod: Object.freeze({identity:true,balance:true,catalog:true,capacityReservation:false,autoChargeProof:false,provision:false,cancel:false})
});
export interface SupplierRequirements { provider: SupplierId; accountId: string; offerId: string; gpuModel: string; gpuCount: number; minVramGb: number; maxExposureCents: number }
/** Caller flags cannot establish verification: all financial and capacity facts are in the signed receipt. */
export function qualifySupplier(receipt: EvidenceReceipt, req: SupplierRequirements, authority: EvidenceAuthority, now = Date.now()) {
  const review = authority.assess(receipt,'SUPPLIER','supplier:'+req.provider,req.accountId,now);
  const rejected = (reason: string) => ({...review,status:'REJECTED' as EvidenceStatus,reasons:[reason],purchasingAllowed:false as const});
  const f = receipt?.payload?.facts;
  if (!['vast_ai','runpod'].includes(req.provider) || !f || f.offerId !== req.offerId || f.gpuModel !== req.gpuModel ||
      !integer(req.gpuCount,128) || req.gpuCount < 1 || !integer(req.minVramGb,512) || req.minVramGb < 1 ||
      !integer(req.maxExposureCents) || !integer(f.gpuCount,128) || f.gpuCount < req.gpuCount ||
      typeof f.vramGb !== 'number' || !Number.isFinite(f.vramGb) || f.vramGb < req.minVramGb ||
      !integer(f.totalHourlyCents) || f.totalHourlyCents < 1 || !integer(f.balanceCents) || f.balanceCents < req.maxExposureCents ||
      f.currency !== 'USD' || f.available !== true || f.billingMode !== 'PREPAID' || f.autoChargeDisabled !== true ||
      typeof f.termsReference !== 'string' || !f.termsReference.trim()) return rejected('SUPPLIER_REQUIREMENTS_OR_BILLING_UNPROVEN');
  return {...review,purchasingAllowed:false as const};
}
/** Reviewed collector contract only. No credentials or mutating methods belong in this interface. */
export interface ReadOnlySupplierCollector { readonly provider: SupplierId; collect(signal: AbortSignal): Promise<EvidenceReceipt> }
export class SupplierCollectionLimiter {
  private readonly inflight = new Set<SupplierId>();
  private readonly nextAllowed = new Map<SupplierId,number>();
  async collect(collector: ReadOnlySupplierCollector, now = Date.now()): Promise<EvidenceReceipt> {
    if (!integer(now) || !['vast_ai','runpod'].includes(collector.provider)) throw Error('INVALID_COLLECTOR');
    const provider = collector.provider;
    if (this.inflight.has(provider) || now < (this.nextAllowed.get(provider) ?? 0)) throw Error('SUPPLIER_RATE_LIMIT');
    this.inflight.add(provider); this.nextAllowed.set(provider,now+30000);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const receipt = await Promise.race([collector.collect(controller.signal), new Promise<never>((_,reject) => {
        timer=setTimeout(() => { controller.abort(); reject(Error('COLLECTION_TIMEOUT')); },6000);
      })]);
      // Structural bounds before any downstream signature/qualification work.
      if (typeof receipt !== 'object' || receipt === null || Buffer.byteLength(JSON.stringify(receipt)) > 32768) throw Error('INVALID_COLLECTOR_RESPONSE');
      return structuredClone(receipt);
    } catch { throw Error('READ_ONLY_COLLECTION_FAILED'); }
    finally { clearTimeout(timer); this.inflight.delete(provider); }
  }
}
