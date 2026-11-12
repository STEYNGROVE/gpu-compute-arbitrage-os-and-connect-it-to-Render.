import { integer, reference } from './evidence.js';
import { strictPublicationTimestamp } from '../publicationTimestamp.js';
export interface CostEvidence {
  evidenceId: string; sourceUrl: string; origin: 'SIMULATION' | 'INDEPENDENT_READ_ONLY';
  provider: 'vast_ai' | 'runpod'; offerId: string; accountId: string; gpuModel: string;
  bundleGpuCount: number; vramGb: number; bundleHourlyMinor: number; currency: string;
  observedAt: string; expiresAt: string;
}
export interface QuotePlanInput {
  supplier: CostEvidence;
  requirement: {gpuModel: string; gpuCount: number; minVramGb: number; durationMinutes: number; utilizationBps: number};
  customerQuoteCents: number; platformFeeBps: number; taxBps: number; contingencyBps: number; minimumMarginBps: number;
  networkCents: number; storageCents: number; operatingCents: number;
  contractReference: string; paymentObligationReference: string;
  fx: null | {fromCurrency: string; toCurrency: 'USD'; basis: 'MINOR_TO_USD_CENTS'; numerator: number; denominator: number; sourceUrl: string; observedAt: string; expiresAt: string; evidenceId: string};
}
const MAX=100_000_000;
function fresh(observed:string,expires:string,now:number) {
  const start=strictPublicationTimestamp(observed),end=strictPublicationTimestamp(expires);
  return Number.isFinite(start) && Number.isFinite(end) && start<=now && end>now && end>start && end-start<=900000 && now-start<=900000;
}
import { safePublicReference } from './evidence.js';
/** Integer cents, upward-rounded supplier costs, downward-rounded utilization revenue. All costs explicit. */
export function planEvidenceQuote(input: QuotePlanInput, now=Date.now()) {
  const s=input?.supplier,r=input?.requirement;
  if (!integer(now) || !s || !r || !['vast_ai','runpod'].includes(s.provider) || !['SIMULATION','INDEPENDENT_READ_ONLY'].includes(s.origin) ||
      !reference(s.evidenceId) || !reference(s.offerId) || !reference(s.accountId) || !safePublicReference(s.sourceUrl) ||
      !fresh(s.observedAt,s.expiresAt,now) || !integer(s.bundleHourlyMinor,MAX) || s.bundleHourlyMinor<1 ||
      !integer(s.bundleGpuCount,128) || s.bundleGpuCount<1 || !integer(s.vramGb,512) ||
      typeof r.gpuModel!=='string' || !r.gpuModel.trim() || r.gpuModel!==s.gpuModel ||
      !integer(r.gpuCount,128) || r.gpuCount<1 || r.gpuCount>s.bundleGpuCount || !integer(r.minVramGb,512) || r.minVramGb<1 || r.minVramGb>s.vramGb ||
      !integer(r.durationMinutes,525600) || r.durationMinutes<1 || !integer(r.utilizationBps,10000) || r.utilizationBps<1 ||
      !integer(input.customerQuoteCents,MAX) || input.customerQuoteCents<1 ||
      ![input.platformFeeBps,input.taxBps,input.contingencyBps,input.minimumMarginBps].every(n=>integer(n,10000)) || input.minimumMarginBps>=10000 ||
      ![input.networkCents,input.storageCents,input.operatingCents].every(n=>integer(n,MAX)) ||
      !reference(input.contractReference) || !reference(input.paymentObligationReference)) throw Error('INVALID_OR_MISSING_COST_EVIDENCE');
  let numerator=1n,denominator=1n;
  if (s.currency!=='USD') {
    const fx=input.fx;
    if (!/^[A-Z]{3}$/.test(s.currency) || !fx || fx.fromCurrency!==s.currency || fx.toCurrency!=='USD' || fx.basis!=='MINOR_TO_USD_CENTS' || !reference(fx.evidenceId) ||
        !safePublicReference(fx.sourceUrl) || !fresh(fx.observedAt,fx.expiresAt,now) || !integer(fx.numerator,MAX) || fx.numerator<1 ||
        !integer(fx.denominator,MAX) || fx.denominator<1) throw Error('FX_EVIDENCE_REQUIRED');
    numerator=BigInt(fx.numerator);denominator=BigInt(fx.denominator);
  } else if (input.fx!==null) throw Error('UNEXPECTED_FX_CONVERSION');
  const ceil=(n:bigint,d:bigint)=>(n+d-1n)/d;
  const supplier=ceil(BigInt(s.bundleHourlyMinor)*BigInt(r.durationMinutes)*numerator,60n*denominator);
  const revenue=BigInt(input.customerQuoteCents)*BigInt(r.utilizationBps)/10000n;
  const platform=ceil(revenue*BigInt(input.platformFeeBps),10000n);
  const subtotal=supplier+BigInt(input.networkCents)+BigInt(input.storageCents)+BigInt(input.operatingCents)+platform;
  const tax=ceil(subtotal*BigInt(input.taxBps),10000n),contingency=ceil(subtotal*BigInt(input.contingencyBps),10000n);
  const total=subtotal+tax+contingency,profit=revenue-total;
  if (total>BigInt(MAX) || revenue===0n || profit<=0n || profit*10000n<revenue*BigInt(input.minimumMarginBps)) return null;
  const validUntil=Math.min(strictPublicationTimestamp(s.expiresAt),now+900000,input.fx ? strictPublicationTimestamp(input.fx.expiresAt) : Infinity);
  return {status:'DRAFT_REQUIRES_VERIFICATION',currency:'USD',supplierCostCents:Number(supplier),platformFeeCents:Number(platform),taxCents:Number(tax),contingencyCents:Number(contingency),
    totalEstimatedCostCents:Number(total),estimatedRevenueCents:Number(revenue),estimatedProfitCents:Number(profit),
    validUntil:new Date(validUntil).toISOString(),costEvidenceId:s.evidenceId,sourceUrl:s.sourceUrl,
    fxEvidenceId:input.fx?.evidenceId ?? null,capacityVerified:false,contractVerified:false,paymentVerified:false,
    realizedRevenueCents:0,purchasingAllowed:false,financialPostingPerformed:false,origin:s.origin};
}
