import type { Express, Request, Response, NextFunction } from 'express';

type Auth = (req: Request, res: Response, next: NextFunction) => void;
const FINITE = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nonnegative = (v: unknown): v is number => FINITE(v) && v >= 0;
const money = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const MAX_NODES = 40;
const HORIZON_HOURS = 720;
const GPUS_PER_NODE = 8;
const TARGET_UTILIZATION = 95;
const ALERT_FLOOR = 56.07;

export interface H100NodeObservation {
  nodeId: string;
  gpuCount: number;
  gpuModel: string;
  state: 'active' | 'inactive' | 'unknown';
  tenantType: 'retainer' | 'retail' | 'api' | 'sublease' | 'unallocated' | 'unknown';
  allocatedGpuSeconds: number;
  availableGpuSeconds: number;
  observedAt: string;
  evidenceId: string;
}
export interface H100FinancialEvidence {
  supplierPaidUsd: number;
  tenantClearedUsd: number;
  otherPaidCostsUsd: number;
  outstandingLiabilitiesUsd: number;
  clearedFundsVerified: boolean;
  supplierInvoicesVerified: boolean;
  sourceReference: string;
}
export interface H100Snapshot {
  nodes: H100NodeObservation[];
  finance?: H100FinancialEvidence;
  insuranceReservePct?: number;
  utilizationAlertFloorPct?: number;
}

function timestamp(v: string) {
  const n = Date.parse(v);
  return Number.isFinite(n) && n <= Date.now() + 60000 && n >= Date.now() - 86400000;
}
export function analyzeH100Fleet(snapshot: H100Snapshot) {
  if (!snapshot || !Array.isArray(snapshot.nodes) || snapshot.nodes.length > MAX_NODES) throw new Error('INVALID_NODE_COUNT');
  if (snapshot.insuranceReservePct !== undefined && (!FINITE(snapshot.insuranceReservePct) || snapshot.insuranceReservePct < 0 || snapshot.insuranceReservePct > 100)) throw new Error('INVALID_RESERVE');
  if (snapshot.utilizationAlertFloorPct !== undefined && (!FINITE(snapshot.utilizationAlertFloorPct) || snapshot.utilizationAlertFloorPct < 0 || snapshot.utilizationAlertFloorPct > 100)) throw new Error('INVALID_ALERT_FLOOR');
  const ids = new Set<string>();
  for (const n of snapshot.nodes) {
    if (!n || typeof n.nodeId !== 'string' || !/^[A-Za-z0-9_.-]{1,80}$/.test(n.nodeId) || ids.has(n.nodeId)) throw new Error('INVALID_OR_DUPLICATE_NODE_ID');
    ids.add(n.nodeId);
    if (n.gpuCount !== GPUS_PER_NODE || n.gpuModel !== 'NVIDIA H100 SXM5 80GB') throw new Error('GPU_HARDWARE_MISMATCH');
    if (!['active','inactive','unknown'].includes(n.state) || !['retainer','retail','api','sublease','unallocated','unknown'].includes(n.tenantType)) throw new Error('INVALID_NODE_STATE');
    if (!nonnegative(n.allocatedGpuSeconds) || !nonnegative(n.availableGpuSeconds) || n.allocatedGpuSeconds > n.availableGpuSeconds || !n.evidenceId || typeof n.evidenceId !== 'string' || n.evidenceId.length > 160 || !timestamp(n.observedAt)) throw new Error('INVALID_NODE_EVIDENCE');
    if (n.state !== 'active' && (n.allocatedGpuSeconds > 0 || n.availableGpuSeconds > 0)) throw new Error('INACTIVE_NODE_HAS_RUNTIME');
  }
  const active = snapshot.nodes.filter(n => n.state === 'active');
  const observed = active.reduce((v,n) => v+n.availableGpuSeconds,0);
  const allocated = active.reduce((v,n) => v+n.allocatedGpuSeconds,0);
  const utilizationPct = observed > 0 ? allocated / observed * 100 : null;
  const floor = snapshot.utilizationAlertFloorPct ?? ALERT_FLOOR;
  const reservePct = snapshot.insuranceReservePct ?? 8;
  const completeInventory = snapshot.nodes.length === MAX_NODES;
  const finance = snapshot.finance;
  if (finance && (!nonnegative(finance.supplierPaidUsd) || !nonnegative(finance.tenantClearedUsd) || !nonnegative(finance.otherPaidCostsUsd) || !nonnegative(finance.outstandingLiabilitiesUsd) || typeof finance.clearedFundsVerified !== 'boolean' || typeof finance.supplierInvoicesVerified !== 'boolean' || typeof finance.sourceReference !== 'string' || !finance.sourceReference.trim())) throw new Error('INVALID_FINANCIAL_EVIDENCE');
  const financialVerified = false; // User-supplied flags cannot independently verify financial evidence.
  const reserveUsd = financialVerified ? money(finance!.tenantClearedUsd * reservePct / 100) : null;
  const distributableUsd = financialVerified ? money(Math.max(0, finance!.tenantClearedUsd - finance!.supplierPaidUsd - finance!.otherPaidCostsUsd - finance!.outstandingLiabilitiesUsd - reserveUsd!)) : null;
  const netRealizedMarginUsd = financialVerified ? money(finance!.tenantClearedUsd - finance!.supplierPaidUsd - finance!.otherPaidCostsUsd) : null;
  return {
    mode: 'READ_ONLY_EVIDENCE_GATED', fleetClaim: { nodes: MAX_NODES, gpusPerNode: GPUS_PER_NODE, gpuCount: 320, horizonHours: HORIZON_HOURS, targetUtilizationPct: TARGET_UTILIZATION },
    inventory: { received: snapshot.nodes.length, complete: completeInventory, activeNodes: active.length, verifiedProvisioning: false, nodes: snapshot.nodes.map(n=>({nodeId:n.nodeId,state:n.state,tenantType:n.tenantType,evidenceId:n.evidenceId})) },
    telemetry: { allocatedGpuSeconds: allocated, availableGpuSeconds: observed, utilizationPct, alertFloorPct: floor, warningPayload: utilizationPct !== null && utilizationPct < floor ? {event:'fleet.utilization.below_floor', threshold_pct:floor, observed_utilization_pct:utilizationPct, observed_at:new Date().toISOString(), active_nodes:active.length, telemetry_verified:false, delivery_status:'NOT_SENT'} : null, telemetryUnavailable: utilizationPct === null },
    finance: { evidenceVerified: financialVerified, netRealizedMarginUsd, insuranceReserveUsd:reserveUsd, distributableUsd, reinvestment80Usd:distributableUsd === null ? null : money(distributableUsd * .8), distribution20Usd:distributableUsd === null ? null : money(distributableUsd - money(distributableUsd * .8)), netHourlyCashflowUsd:null, breakEvenOccupancyPct:null, note:'Hourly cashflow and break-even require verified interval-aligned supplier/tenant contracts and cost curves. All supplied financial evidence remains unverified until independently reconciled.' },
    controls: { procurementEnabled:false, stakingEnabled:false, payoutsEnabled:false, webhookSent:false, executionEligible:false }
  };
}
export function registerH100FleetController(app: Express, owner: Auth) {
  app.post('/api/owner/h100-fleet/analyze', owner, (req, res) => {
    res.setHeader('Cache-Control','no-store');
    try { return res.json(analyzeH100Fleet(req.body as H100Snapshot)); }
    catch (e) { return res.status(400).json({error:e instanceof Error ? e.message : 'INVALID_FLEET_REQUEST'}); }
  });
}
