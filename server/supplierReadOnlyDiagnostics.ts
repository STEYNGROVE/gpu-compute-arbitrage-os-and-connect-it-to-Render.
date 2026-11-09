import { assessGpuOffer } from './gpuOfferEvidence.js';
import { matchGpuDemand } from './gpuDemandMatcher.js';
import {
  compareGpuOffers,
  compareGpuOffersPerGpu,
  type GpuOffer
} from './gpuPriceComparison.js';
import type { Express, RequestHandler } from 'express';

type Supplier = 'vast_ai' | 'runpod';
type Probe = { supplier: Supplier; configured: boolean; authenticated: boolean; identityHttpStatus: number | null; inventoryHttpStatus: number | null; inventoryRecords: number | null; pricedRecords: number | null; latencyMs: number; errorCode: string | null; checkedAt: string; readOnly: true; procurementBlocked: true };
const endpoints = {
  vast_ai: { origin: 'https://console.vast.ai', identity: 'https://console.vast.ai/api/v0/users/current/', inventory: 'https://console.vast.ai/api/v0/bundles/?q=%7B%22verified%22%3A%7B%22eq%22%3Atrue%7D%7D' },
  runpod: { origin: 'https://api.runpod.io', identity: 'https://api.runpod.io/graphql', inventory: 'https://api.runpod.io/graphql' }
} as const;
const identityQuery = JSON.stringify({query:'query SupplierIdentity { myself { id } }'});
const inventoryQuery = JSON.stringify({query:'query SupplierInventory { gpuTypes { id securePrice lowestPrice { uninterruptablePrice } } }'});

async function requestJson(url: string, key: string, method: 'GET'|'POST', body?: string): Promise<{ status: number; data: any }> {
  const expected = method === 'GET' ? endpoints.vast_ai.origin : endpoints.runpod.origin;
  if (new URL(url).origin !== expected) throw new Error('ENDPOINT_BLOCKED');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, {
      method, redirect: 'error', signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', ...(method === 'POST' ? {'Content-Type':'application/json'} : {}) },
      ...(body ? { body } : {})
    });
    if (!response.ok) return { status: response.status, data: null };
    const data = await response.json();
    return { status: response.status, data };
  } finally { clearTimeout(timeout); }
}

export async function probeSupplier(supplier: Supplier): Promise<Probe> {
  const key = supplier === 'vast_ai' ? (process.env.VAST_API_KEY || '') : (process.env.RUNPOD_API_KEY || '');
  const start = Date.now();
  const result: Probe = { supplier, configured: key.trim().length > 5, authenticated: false, identityHttpStatus: null, inventoryHttpStatus: null, inventoryRecords: null, pricedRecords: null, latencyMs: 0, errorCode: null, checkedAt: new Date().toISOString(), readOnly: true, procurementBlocked: true };
  try {
    if (!result.configured) { result.errorCode='KEY_REQUIRED'; return result; }
    const ep=endpoints[supplier];
    const isVast=supplier==='vast_ai';
    const identity=await requestJson(ep.identity,key,isVast?'GET':'POST',isVast?undefined:identityQuery);
    result.identityHttpStatus=identity.status;
    if (identity.status !== 200) { result.errorCode='IDENTITY_HTTP_'+identity.status; return result; }
    if (!isVast && Array.isArray(identity.data?.errors) && identity.data.errors.length) { result.errorCode='IDENTITY_GRAPHQL_ERROR'; return result; }
    result.authenticated=isVast ? Boolean(identity.data && (identity.data.id || identity.data.username || identity.data.email)) : Boolean(identity.data?.data?.myself?.id);
    if (!result.authenticated) { result.errorCode='IDENTITY_UNVERIFIED'; return result; }
    const inventory=await requestJson(ep.inventory,key,isVast?'GET':'POST',isVast?undefined:inventoryQuery);
    result.inventoryHttpStatus=inventory.status;
    if (inventory.status !== 200) { result.errorCode='INVENTORY_HTTP_'+inventory.status; return result; }
    if (!isVast && Array.isArray(inventory.data?.errors) && inventory.data.errors.length) { result.errorCode='INVENTORY_GRAPHQL_ERROR'; return result; }
    const rows=isVast?inventory.data?.offers:inventory.data?.data?.gpuTypes;
    if (!Array.isArray(rows)) { result.errorCode='INVENTORY_SCHEMA_UNVERIFIED'; return result; }
    result.inventoryRecords=rows.length;
    result.pricedRecords=rows.filter((r:any)=>{
      const price=isVast ? Number(r.dph_total ?? r.dph_base) : Number(r.lowestPrice?.uninterruptablePrice ?? r.securePrice);
      return Number.isFinite(price) && price>0;
    }).length;
    return result;
  } catch { result.errorCode='NETWORK_OR_PARSE_FAILURE'; return result; }
  finally { result.latencyMs=Date.now()-start; }
}


async function fetchComparisonOffers(): Promise<GpuOffer[]> {
  const offers: GpuOffer[] = [];
  const checkedAt = new Date().toISOString();

  const vastKey = process.env.VAST_API_KEY;
  const runpodKey = process.env.RUNPOD_API_KEY;

  if (!vastKey && !runpodKey) {
    throw new Error('SUPPLIER_KEY_REQUIRED');
  }

  if (vastKey) {
    try {
      const response = await requestJson(
        endpoints.vast_ai.inventory,
        vastKey,
        'GET'
      );

      if (response.status === 200 &&
          Array.isArray(response.data?.offers)) {
        for (const row of response.data.offers) {
          const model = String(
            row.gpu_name || row.gpu_model || ''
          );

          const price = Number(
            row.dph_total ?? row.dph_base
          );

          const gpuCount = Number(row.num_gpus ?? 1);

          if (!/4090|a100|h100/i.test(model)) continue;
          if (!Number.isFinite(price) || price <= 0) continue;
          if (!Number.isInteger(gpuCount) || gpuCount < 1) continue;

          offers.push({
            provider: 'vast_ai',
            offerId: String(row.id ?? row.bundle_id ?? ''),
            model,
            gpuCount,
            vramGb: null,
            region: null,
            totalHourlyUsd: price,
            available: null,
            checkedAt
          });
        }
      } else {
        throw new Error('VAST_INVENTORY_SCHEMA_OR_HTTP_ERROR');
      }
    } catch {
      console.warn('VAST_INVENTORY_UNAVAILABLE');
    }
  }

  if (runpodKey) {
    try {
      const response = await requestJson(
        endpoints.runpod.inventory,
        runpodKey,
        'POST',
        inventoryQuery
      );

      const rows = response.data?.data?.gpuTypes;

      if (response.status === 200 &&
          !response.data?.errors &&
          Array.isArray(rows)) {
        for (const row of rows) {
          const model = String(row.id ?? '');

          const price = Number(
            row.lowestPrice?.uninterruptablePrice ??
            row.securePrice
          );

          if (!/4090|a100|h100/i.test(model)) continue;
          if (!Number.isFinite(price) || price <= 0) continue;

          offers.push({
            provider: 'runpod',
            offerId: model,
            model,
            gpuCount: 1,
            vramGb: null,
            region: null,
            totalHourlyUsd: price,
            available: null,
            checkedAt
          });
        }
      } else {
        throw new Error('RUNPOD_INVENTORY_SCHEMA_OR_HTTP_ERROR');
      }
    } catch {
      console.warn('RUNPOD_INVENTORY_UNAVAILABLE');
    }
  }

  if (offers.length === 0) {
    throw new Error('NO_VERIFIED_SUPPLIER_CATALOG_OFFERS');
  }

  return offers;
}

export function registerSupplierDiagnostics(app: Express, requireOwnerAuth: RequestHandler): void {

  app.get('/api/owner/gpu-price-comparison',
    requireOwnerAuth,
    async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');

      const rawQuote = req.query.customerHourlyUsd;
      const rawCosts = req.query.additionalCostHourlyUsd;

      const quote = rawQuote === undefined
        ? undefined
        : Number(rawQuote);

      const costs = rawCosts === undefined
        ? 0
        : Number(rawCosts);

      if ((rawQuote !== undefined &&
           (typeof rawQuote !== 'string' ||
            !Number.isFinite(quote) ||
            quote! <= 0)) ||
          (rawCosts !== undefined &&
           (typeof rawCosts !== 'string' ||
            !Number.isFinite(costs) ||
            costs < 0))) {
        return res.status(400).json({
          error: 'INVALID_PRICING_INPUT'
        });
      }

      let offers: GpuOffer[];
      try {
        offers = await fetchComparisonOffers();
      } catch {
        return res.status(503).json({
          mode: 'READ_ONLY',
          error: 'SUPPLIER_COMPARISON_UNAVAILABLE',
          procurementBlocked: true,
          tradingBlocked: true,
          payoutsBlocked: true
        });
      }

      res.json({
        mode: 'READ_ONLY',
        procurementBlocked: true,
        tradingBlocked: true,
        payoutsBlocked: true,
        pricingStatus: 'CATALOG_ONLY',
        verifiedCustomer: false,
        confirmedAvailability: false,
        comparisons: compareGpuOffers(offers, quote, costs)
      });
    }
  );


  app.get('/api/owner/gpu-price-comparison-normalized',
    requireOwnerAuth,
    async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');

      const quoteRaw = req.query.customerPerGpuHourUsd;
      const costsRaw = req.query.additionalCostPerGpuHourUsd;

      const quote = quoteRaw === undefined
        ? undefined : Number(quoteRaw);
      const costs = costsRaw === undefined
        ? 0 : Number(costsRaw);

      if (
        (quoteRaw !== undefined &&
          (typeof quoteRaw !== 'string' ||
           quoteRaw.trim() === '' ||
           !Number.isFinite(quote) ||
           quote! <= 0)) ||
        (costsRaw !== undefined &&
          (typeof costsRaw !== 'string' ||
           costsRaw.trim() === '' ||
           !Number.isFinite(costs) ||
           costs < 0))
      ) {
        return res.status(400).json({
          error: 'INVALID_PRICING_INPUT'
        });
      }

      try {
        const offers = await fetchComparisonOffers();

        return res.json({
          mode: 'READ_ONLY',
          procurementBlocked: true,
          tradingBlocked: true,
          payoutsBlocked: true,
          pricingStatus: 'CATALOG_ONLY',
          pricingBasis: 'PER_GPU_HOUR',
          verifiedCustomer: false,
          confirmedAvailability: false,
          comparisons: compareGpuOffersPerGpu(
            offers, quote, costs
          ).map(offer => ({
            ...offer,
            evidence: assessGpuOffer({
              provider: offer.provider as
                'vast_ai' | 'runpod',
              offerId: offer.offerId,
              model: offer.model,
              gpuCount: offer.gpuCount,
              pricePerGpuHourUsd:
                offer.supplierPerGpuHourUsd,
              checkedAt: offer.checkedAt,
              capacityVerified: false,
              available: null,
              source: 'SUPPLIER_CATALOG'
            })
          }))
        });
      } catch {
        return res.status(503).json({
          mode: 'READ_ONLY',
          error: 'SUPPLIER_COMPARISON_UNAVAILABLE',
          procurementBlocked: true,
          tradingBlocked: true,
          payoutsBlocked: true
        });
      }
    }
  );


  app.post('/api/owner/gpu-demand-match',
    requireOwnerAuth,
    async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');

      const body = req.body;

      if (!body || typeof body !== 'object' ||
          Array.isArray(body) ||
          typeof body.gpuModel !== 'string' ||
          body.gpuModel.length > 100 ||
          !body.gpuModel.trim() ||
          !Number.isInteger(body.gpuCount) ||
          body.gpuCount < 1 || body.gpuCount > 128 ||
          !Number.isFinite(body.durationHours) ||
          body.durationHours <= 0 ||
          body.durationHours > 8760 ||
          !Number.isFinite(body.maxCustomerPricePerGpuHourUsd) ||
          body.maxCustomerPricePerGpuHourUsd <= 0 ||
          body.maxCustomerPricePerGpuHourUsd > 10000 ||
          !Number.isFinite(body.additionalCostPerGpuHourUsd) ||
          body.additionalCostPerGpuHourUsd < 0 ||
          body.additionalCostPerGpuHourUsd > 10000) {
        return res.status(400).json({
          error: 'INVALID_CUSTOMER_REQUIREMENT'
        });
      }

      try {
        const offers = await fetchComparisonOffers();

        const normalized = compareGpuOffersPerGpu(
          offers,
          body.maxCustomerPricePerGpuHourUsd,
          body.additionalCostPerGpuHourUsd
        );

        const matches = matchGpuDemand(body, normalized)
          .map(match => {
            const additionalCost =
              body.additionalCostPerGpuHourUsd *
              body.gpuCount *
              body.durationHours;

            return {
              ...match,
              estimatedAdditionalCostUsd: additionalCost,
              estimatedGrossSpreadUsd:
                match.estimatedGrossSpreadUsd - additionalCost
            };
          })
          .filter(match =>
            Number.isFinite(match.estimatedGrossSpreadUsd) &&
            match.estimatedGrossSpreadUsd > 0
          );

        return res.json({
          mode: 'READ_ONLY',
          pricingStatus: 'CATALOG_ONLY',
          procurementBlocked: true,
          tradingBlocked: true,
          payoutsBlocked: true,
          verifiedCustomer: false,
          confirmedAvailability: false,
          paymentVerified: false,
          realizedRevenueUsd: 0,
          matches
        });
      } catch {
        return res.status(503).json({
          error: 'DEMAND_MATCHING_UNAVAILABLE',
          mode: 'READ_ONLY',
          procurementBlocked: true,
          tradingBlocked: true,
          payoutsBlocked: true
        });
      }
    }
  );

  // Owner auth is required even though this route only reads supplier information.
  app.get('/api/owner/supplier-diagnostics', requireOwnerAuth, async (_req,res)=>{
    res.setHeader('Cache-Control','no-store');
    const [vast,runpod]=await Promise.all([probeSupplier('vast_ai'),probeSupplier('runpod')]);
    res.json({ mode:'READ_ONLY', procurementBlocked:true, tradingBlocked:true, payoutsBlocked:true, suppliers:[vast,runpod] });
  });
}
