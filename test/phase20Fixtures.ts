import type { GatewayRequest } from '../server/phase20/gateway.js';
import type { EvidenceReceipt } from '../server/phase20/evidence.js';
import type { QuotePlanInput } from '../server/phase20/quotation.js';
export const now=Date.parse('2026-11-12T12:00:00Z');
export const request: GatewayRequest={mode:'SIMULATION',idempotencyKey:'phase20_request_0001',customerId:'customer_test01',workloadId:'workload_test01',
  provider:'vast_ai',accountId:'account_test01',offerId:'offer_test0001',gpuModel:'H100',gpuCount:1,minVramGb:80,maxCostCents:150,maxRuntimeMs:60000,
  contractEvidenceId:'contract_test01',supplierEvidenceId:'supplier_test01',paymentEvidenceId:'payment_test001',approvalEvidenceId:'approval_test01'};
export const receipt: EvidenceReceipt={issuer:'issuer_test01',signature:'',payload:{kind:'SUPPLIER',subjectId:'supplier:vast_ai',accountId:'account_test01',origin:'SIMULATION',
  sourceUrl:'https://example.org/supplier-evidence',observedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+60000).toISOString(),
  facts:{offerId:'offer_test0001',gpuModel:'H100',gpuCount:2,vramGb:80,totalHourlyCents:100,balanceCents:1000,currency:'USD',available:true,billingMode:'PREPAID',autoChargeDisabled:true,termsReference:'terms_test01'}}};
export const quote: QuotePlanInput={supplier:{evidenceId:'cost_test0001',sourceUrl:'https://example.org/cost',origin:'SIMULATION',provider:'vast_ai',offerId:'offer_test0001',accountId:'account_test01',
  gpuModel:'H100',bundleGpuCount:4,vramGb:80,bundleHourlyMinor:100,currency:'USD',observedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+60000).toISOString()},
  requirement:{gpuModel:'H100',gpuCount:1,minVramGb:80,durationMinutes:120,utilizationBps:8000},customerQuoteCents:1000,platformFeeBps:500,taxBps:1000,contingencyBps:1000,
  minimumMarginBps:1000,networkCents:10,storageCents:20,operatingCents:30,contractReference:'contract_test01',paymentObligationReference:'obligation_test01',fx:null};
