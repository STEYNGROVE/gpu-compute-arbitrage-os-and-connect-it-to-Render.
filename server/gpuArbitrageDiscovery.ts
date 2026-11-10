import type { Express, Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';

type Auth = (req: Request, res: Response, next: NextFunction) => void;
type Quote = {
  provider: string; offerId: string; gpu: string; gpuCount: number;
  hourlyUsd: number; verified: boolean; available: boolean;
  evidenceUrl: string; observedAt: string;
};
type Demand = {
  source: string; orderId: string; gpu: string; gpuCount: number;
  maxHourlyUsd: number; durationHours: number;
  evidenceUrl: string; observedAt: string;
  customerVerified: boolean; fundsVerified: boolean;
  fulfillmentCompatible: boolean;
};
const MAX_AGE_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 100;
const numeric = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const str = (v: unknown, max = 160) =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const publicEvidence = (value: unknown) => {
  if (!str(value, 1500)) return false;
  try {
    const u = new URL(value as string);
    const h = u.hostname.toLowerCase();
    return u.protocol === 'https:' && !u.username && !u.password &&
      (!u.port || u.port === '443') && h.includes('.') &&
      !h.endsWith('.local') && !h.endsWith('.internal') &&
      !/^\d+(\.\d+){3}$/.test(h) && !h.includes(':');
  } catch { return false; }
};
const timestamp = (value: unknown) => str(value, 50) &&
  Number.isFinite(Date.parse(value as string)) &&
  Date.parse(value as string) <= Date.now() + 60_000;
const fresh = (value: string) => Date.now() - Date.parse(value) <= MAX_AGE_MS;
const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function evaluateGpuMatches(
  offers: Quote[], demands: Demand[],
  settings: { minimumNetMargin: number; maxHourlyWholesaleUsd: number; reservePct: number }
) {
  const matches = [];
  for (const demand of demands) for (const offer of offers) {
    if (normalize(demand.gpu) !== normalize(offer.gpu) ||
        offer.gpuCount < demand.gpuCount) continue;
    const wholesaleHourlyUsd = offer.hourlyUsd * demand.gpuCount;
    const revenueUsd = demand.maxHourlyUsd * demand.durationHours;
    const wholesaleUsd = wholesaleHourlyUsd * demand.durationHours;
    const riskReserveUsd = wholesaleUsd * settings.reservePct;
    const estimatedNetUsd = revenueUsd - wholesaleUsd - riskReserveUsd;
    const estimatedMargin = revenueUsd > 0 ? estimatedNetUsd / revenueUsd : -1;
    const blockers: string[] = [];
    if (!offer.verified || !offer.available) blockers.push('SUPPLY_NOT_VERIFIED_AVAILABLE');
    if (!fresh(offer.observedAt) || !fresh(demand.observedAt)) blockers.push('STALE_EVIDENCE');
    if (!demand.customerVerified) blockers.push('CUSTOMER_NOT_VERIFIED');
    if (!demand.fundsVerified) blockers.push('PAYMENT_NOT_VERIFIED');
    if (!demand.fulfillmentCompatible) blockers.push('FULFILLMENT_NOT_VERIFIED');
    if (wholesaleHourlyUsd > settings.maxHourlyWholesaleUsd) blockers.push('HOURLY_BUDGET_EXCEEDED');
    if (estimatedMargin < settings.minimumNetMargin) blockers.push('MARGIN_BELOW_THRESHOLD');
    // These quotes exclude unknown platform, tax, network and operational costs.
    // Never grant execution eligibility from estimated economics.
    blockers.push('FULL_COST_AND_EXECUTION_APPROVAL_REQUIRED');
    matches.push({
      id: createHash('sha256').update(`${offer.provider}:${offer.offerId}:${demand.source}:${demand.orderId}`).digest('hex'),
      provider: offer.provider, offerId: offer.offerId, gpu: offer.gpu,
      demandSource: demand.source, orderId: demand.orderId,
      wholesaleHourlyUsd, retailHourlyUsd: demand.maxHourlyUsd,
      durationHours: demand.durationHours, estimatedNetUsd,
      estimatedMarginPct: Number((estimatedMargin * 100).toFixed(2)),
      supplyEvidenceUrl: offer.evidenceUrl, demandEvidenceUrl: demand.evidenceUrl,
      blockers, executionEligible: false, procurementEnabled: false,
      realizedRevenueUsd: 0, evidenceStatus: 'USER_SUPPLIED_UNVERIFIED'
    });
  }
  return matches.sort((a, b) => b.estimatedNetUsd - a.estimatedNetUsd);
}

export function registerGpuArbitrageDiscovery(app: Express, owner: Auth) {
  app.post('/api/owner/gpu-arbitrage/discover', owner, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const b = req.body;
    if (!b || !Array.isArray(b.offers) || !Array.isArray(b.demands) ||
        b.offers.length > MAX_ENTRIES || b.demands.length > MAX_ENTRIES ||
        !numeric(b.minimumNetMargin ?? 0.35, 0, 1) ||
        !numeric(b.maxHourlyWholesaleUsd ?? 2.5, 0, 10000) ||
        !numeric(b.reservePct ?? 0.15, 0, 1)) {
      return res.status(400).json({ error: 'INVALID_DISCOVERY_REQUEST' });
    }
    const offers = b.offers as Quote[];
    const demands = b.demands as Demand[];
    const validOffer = (x: Quote) => x && str(x.provider) && str(x.offerId) &&
      str(x.gpu) && numeric(x.gpuCount, 1, 64) && Number.isInteger(x.gpuCount) &&
      numeric(x.hourlyUsd, 0, 10000) && typeof x.verified === 'boolean' &&
      typeof x.available === 'boolean' && publicEvidence(x.evidenceUrl) &&
      timestamp(x.observedAt);
    const validDemand = (x: Demand) => x && str(x.source) && str(x.orderId) &&
      str(x.gpu) && numeric(x.gpuCount, 1, 64) && Number.isInteger(x.gpuCount) &&
      numeric(x.maxHourlyUsd, 0, 10000) &&
      numeric(x.durationHours, 0.01, 720) && publicEvidence(x.evidenceUrl) &&
      timestamp(x.observedAt) && typeof x.customerVerified === 'boolean' &&
      typeof x.fundsVerified === 'boolean' &&
      typeof x.fulfillmentCompatible === 'boolean';
    if (!offers.every(validOffer) || !demands.every(validDemand)) {
      return res.status(400).json({ error: 'INVALID_DISCOVERY_EVIDENCE' });
    }
    return res.json({
      mode: 'READ_ONLY_ANALYSIS',
      evidenceStatus: 'USER_SUPPLIED_UNVERIFIED',
      sourceConnectionsActive: false,
      procurementEnabled: false, biddingEnabled: false, payoutsEnabled: false,
      verifiedCustomers: 0, realizedRevenueUsd: 0,
      warning: 'Input claims are not independently verified. Estimated profit excludes unknown fees and operational costs.',
      matches: evaluateGpuMatches(offers, demands, {
        minimumNetMargin: b.minimumNetMargin ?? 0.35,
        maxHourlyWholesaleUsd: b.maxHourlyWholesaleUsd ?? 2.5,
        reservePct: b.reservePct ?? 0.15
      })
    });
  });
}
