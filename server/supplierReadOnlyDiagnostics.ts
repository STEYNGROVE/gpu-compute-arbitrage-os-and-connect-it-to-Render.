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

export function registerSupplierDiagnostics(app: Express, requireOwnerAuth: RequestHandler): void {
  // Owner auth is required even though this route only reads supplier information.
  app.get('/api/owner/supplier-diagnostics', requireOwnerAuth, async (_req,res)=>{
    res.setHeader('Cache-Control','no-store');
    const [vast,runpod]=await Promise.all([probeSupplier('vast_ai'),probeSupplier('runpod')]);
    res.json({ mode:'READ_ONLY', procurementBlocked:true, tradingBlocked:true, payoutsBlocked:true, suppliers:[vast,runpod] });
  });
}
