import { ProviderId, GpuModel, ProviderOffer } from '../types';

export interface ProviderRawInstance {
  id: string;
  providerId: ProviderId;
  gpuName: string;
  vram: number;
  cpu: number;
  ram: number;
  disk: number;
  loc: string;
  region: 'US-East' | 'US-West' | 'EU-Central' | 'EU-West' | 'AP-East' | 'Global';
  priceHr: number;
  bootSec: number;
  stock: number;
  uptimePct: number;
  type: 'on_demand' | 'spot_interruptible';
  bwGb: number;
  diskGbMo: number;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  hist24h: number;
  termsOk: boolean;
  notes?: string;
  source?: string;
  isLiveApi?: boolean;
}

// Normalized adapter interface
export interface IComputeProviderAdapter {
  providerId: ProviderId;
  providerName: string;
  isHealthy(): Promise<boolean>;
  fetchRawOffers(mode?: 'LIVE' | 'PAPER'): Promise<ProviderRawInstance[]>;
  normalizeOffer(raw: ProviderRawInstance): ProviderOffer;
  calculateSupplyIndex(raw: ProviderRawInstance): number;
  checkCompliance(workloadType: string, region: string): { compliant: boolean; reason?: string };
}

// Compute normalized supply index composite (0-100)
export function computeSupplyIndexScore(
  hourlyPrice: number = 2,
  reliabilityScore: number = 0.99,
  interruptionRisk: 'on_demand' | 'spot_interruptible' = 'on_demand',
  startupTimeSec: number = 30,
  vramGb: number = 24
): number {
  const hp = Number(hourlyPrice ?? 2);
  const rel = Number(reliabilityScore ?? 0.99);
  const vram = Math.max(8, Number(vramGb ?? 24));
  const boot = Number(startupTimeSec ?? 30);
  const priceScore = Math.max(0, 100 - (hp / (vram * 0.08)) * 30);
  const uptimeScore = rel * 100;
  const interruptionScore = interruptionRisk === 'on_demand' ? 95 : 60;
  const latencyScore = Math.max(0, 100 - (boot / 120) * 40);

  const weighted = (priceScore * 0.40) + (uptimeScore * 0.30) + (interruptionScore * 0.20) + (latencyScore * 0.10);
  return Math.round(Math.min(99.9, Math.max(10, weighted)) * 10) / 10;
}

// Vast.ai Adapter Implementation
export class VastAiAdapter implements IComputeProviderAdapter {
  providerId: ProviderId = 'vast_ai';
  providerName = 'Vast.ai Marketplace';

  async isHealthy(): Promise<boolean> {
    return true;
  }

  async fetchRawOffers(mode: 'LIVE' | 'PAPER' = 'LIVE'): Promise<ProviderRawInstance[]> {
    try {
      const res = await fetch(`/api/providers/vast/offers?mode=${mode}`);
      if (res.ok) {
        const json = await res.json();
        if (json.offers && Array.isArray(json.offers)) {
          const isLive = json.source === 'LIVE_VAST_API' && json.isLive === true;
          return json.offers.map((o: ProviderRawInstance) => ({
            ...o,
            isLiveApi: isLive,
            source: json.source || (isLive ? 'LIVE_VAST_API' : 'VERIFIED_MARKET_FEED')
          }));
        }
      }
    } catch (e) {
      console.warn('Backend proxy fetch failed for Vast.ai:', e);
    }

    // STRICT ARCHITECTURAL INVARIANT: LIVE API unavailable -> NO OFFERS -> NO OPPORTUNITY -> NO AUTO
    return [];
  }

  normalizeOffer(raw: ProviderRawInstance): ProviderOffer {
    const priceHr = Number(raw.priceHr ?? 0);
    const hist24h = Number(raw.hist24h ?? priceHr);
    const uptimePct = Number(raw.uptimePct ?? 0.99);
    const vram = Number(raw.vram ?? 24);
    const bootSec = Number(raw.bootSec ?? 30);
    const stock = Number(raw.stock ?? 1);
    const isLive = Boolean(raw.isLiveApi);

    return {
      id: raw.id || `vast-${Date.now()}`,
      provider: 'vast_ai',
      gpuModel: (raw.gpuName || 'RTX 4090 24GB') as GpuModel,
      vramGb: vram,
      cpuCores: Number(raw.cpu ?? 16),
      ramGb: Number(raw.ram ?? 64),
      storageGb: Number(raw.disk ?? 500),
      location: raw.loc || 'Global Datacenter',
      region: raw.region || 'US-East',
      hourlyPrice: priceHr,
      startupTimeSec: bootSec,
      availableInstances: stock,
      reliabilityScore: uptimePct,
      interruptionRisk: raw.type || 'on_demand',
      bandwidthPricePerGb: Number(raw.bwGb ?? 0.01),
      storagePricePerGbMo: Number(raw.diskGbMo ?? 0.10),
      apiHealth: raw.status || 'HEALTHY',
      lastUpdated: new Date().toISOString(),
      historicalAvgPrice24h: hist24h,
      termsCompliant: raw.termsOk !== false,
      providerTermsNotes: raw.notes || '',
      supplyIndexScore: this.calculateSupplyIndex(raw),
      dataProvenance: isLive ? 'LIVE_API_VERIFIED' : 'FALLBACK_MARKET_FEED',
      isLiveApiVerified: isLive,
      liveApiSource: raw.source || (isLive ? 'LIVE_VAST_API' : 'FALLBACK_MARKET_FEED')
    };
  }

  calculateSupplyIndex(raw: ProviderRawInstance): number {
    return computeSupplyIndexScore(raw.priceHr ?? 2, raw.uptimePct ?? 0.99, raw.type || 'on_demand', raw.bootSec ?? 30, raw.vram ?? 24);
  }

  checkCompliance(workloadType: string, _region: string): { compliant: boolean; reason?: string } {
    if (workloadType.toLowerCase().includes('crypto') || workloadType.toLowerCase().includes('mining')) {
      return { compliant: false, reason: 'Vast.ai prohibits non-compliant PoW mining on unapproved instances' };
    }
    return { compliant: true };
  }
}

// RunPod Adapter Implementation
export class RunPodAdapter implements IComputeProviderAdapter {
  providerId: ProviderId = 'runpod';
  providerName = 'RunPod Cloud & Serverless';

  async isHealthy(): Promise<boolean> {
    return true;
  }

  async fetchRawOffers(mode: 'LIVE' | 'PAPER' = 'LIVE'): Promise<ProviderRawInstance[]> {
    try {
      const res = await fetch(`/api/providers/runpod/offers?mode=${mode}`);
      if (res.ok) {
        const json = await res.json();
        if (json.offers && Array.isArray(json.offers)) {
          const isLive = json.source === 'LIVE_RUNPOD_API' && json.isLive === true;
          return json.offers.map((o: ProviderRawInstance) => ({
            ...o,
            isLiveApi: isLive,
            source: json.source || (isLive ? 'LIVE_RUNPOD_API' : 'VERIFIED_MARKET_FEED')
          }));
        }
      }
    } catch (e) {
      console.warn('Backend proxy fetch failed for RunPod:', e);
    }

    // STRICT ARCHITECTURAL INVARIANT: LIVE API unavailable -> NO OFFERS -> NO OPPORTUNITY -> NO AUTO
    return [];
  }

  normalizeOffer(raw: ProviderRawInstance): ProviderOffer {
    const priceHr = Number(raw.priceHr ?? 0);
    const hist24h = Number(raw.hist24h ?? priceHr);
    const uptimePct = Number(raw.uptimePct ?? 0.99);
    const vram = Number(raw.vram ?? 24);
    const bootSec = Number(raw.bootSec ?? 30);
    const stock = Number(raw.stock ?? 1);
    const isLive = Boolean(raw.isLiveApi);

    return {
      id: raw.id || `runpod-${Date.now()}`,
      provider: 'runpod',
      gpuModel: (raw.gpuName || 'RTX 4090 24GB') as GpuModel,
      vramGb: vram,
      cpuCores: Number(raw.cpu ?? 16),
      ramGb: Number(raw.ram ?? 64),
      storageGb: Number(raw.disk ?? 500),
      location: raw.loc || 'Global Datacenter',
      region: raw.region || 'US-East',
      hourlyPrice: priceHr,
      startupTimeSec: bootSec,
      availableInstances: stock,
      reliabilityScore: uptimePct,
      interruptionRisk: raw.type || 'on_demand',
      bandwidthPricePerGb: Number(raw.bwGb ?? 0.01),
      storagePricePerGbMo: Number(raw.diskGbMo ?? 0.10),
      apiHealth: raw.status || 'HEALTHY',
      lastUpdated: new Date().toISOString(),
      historicalAvgPrice24h: hist24h,
      termsCompliant: raw.termsOk !== false,
      providerTermsNotes: raw.notes || '',
      supplyIndexScore: this.calculateSupplyIndex(raw),
      dataProvenance: isLive ? 'LIVE_API_VERIFIED' : 'FALLBACK_MARKET_FEED',
      isLiveApiVerified: isLive,
      liveApiSource: raw.source || (isLive ? 'LIVE_RUNPOD_API' : 'FALLBACK_MARKET_FEED')
    };
  }

  calculateSupplyIndex(raw: ProviderRawInstance): number {
    return computeSupplyIndexScore(raw.priceHr ?? 2, raw.uptimePct ?? 0.99, raw.type || 'on_demand', raw.bootSec ?? 30, raw.vram ?? 24);
  }

  checkCompliance(workloadType: string, _region: string): { compliant: boolean; reason?: string } {
    if (workloadType.toLowerCase().includes('abusive') || workloadType.toLowerCase().includes('ddos')) {
      return { compliant: false, reason: 'Violates RunPod Terms of Service Section 4.2' };
    }
    return { compliant: true };
  }
}

// Lambda Labs Adapter Implementation (OpenAPI 3.1.0 Spec Compliant)
export interface LambdaInstanceLaunchPayload {
  region_name: string;
  instance_type_name: string;
  ssh_key_names: string[];
  name?: string;
  file_system_names?: string[];
  tags?: Array<{ key: string; value: string }>;
}

export class LambdaLabsAdapter implements IComputeProviderAdapter {
  providerId: ProviderId = 'lambda';
  providerName = 'Lambda Cloud';

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch('/api/providers/status');
      if (res.ok) {
        const json = await res.json();
        return json.providers?.lambda?.health === 'HEALTHY';
      }
    } catch {
      // Fallback
    }
    return true;
  }

  async fetchRawOffers(mode: 'LIVE' | 'PAPER' = 'LIVE'): Promise<ProviderRawInstance[]> {
    try {
      const res = await fetch(`/api/providers/lambda/offers?mode=${mode}`);
      if (res.ok) {
        const json = await res.json();
        if (json.offers && Array.isArray(json.offers)) {
          const isLive = json.source === 'LIVE_LAMBDA_API' && json.isLive === true;
          return json.offers.map((o: ProviderRawInstance) => ({
            ...o,
            isLiveApi: isLive,
            source: json.source || (isLive ? 'LIVE_LAMBDA_API' : 'VERIFIED_MARKET_FEED')
          }));
        }
      }
    } catch (e) {
      console.warn('Backend proxy fetch failed for Lambda:', e);
    }

    // STRICT ARCHITECTURAL INVARIANT: LIVE API unavailable -> NO OFFERS -> NO OPPORTUNITY -> NO AUTO
    return [];
  }

  normalizeOffer(raw: ProviderRawInstance): ProviderOffer {
    const priceHr = Number(raw.priceHr ?? 0);
    const hist24h = Number(raw.hist24h ?? priceHr);
    const uptimePct = Number(raw.uptimePct ?? 0.99);
    const vram = Number(raw.vram ?? 24);
    const bootSec = Number(raw.bootSec ?? 30);
    const stock = Number(raw.stock ?? 1);
    const isLive = Boolean(raw.isLiveApi);

    return {
      id: raw.id || `lambda-${Date.now()}`,
      provider: 'lambda',
      gpuModel: (raw.gpuName || 'H100 SXM5 80GB') as GpuModel,
      vramGb: vram,
      cpuCores: Number(raw.cpu ?? 16),
      ramGb: Number(raw.ram ?? 64),
      storageGb: Number(raw.disk ?? 500),
      location: raw.loc || 'US Cloud Datacenter',
      region: raw.region || 'US-East',
      hourlyPrice: priceHr,
      startupTimeSec: bootSec,
      availableInstances: stock,
      reliabilityScore: uptimePct,
      interruptionRisk: raw.type || 'on_demand',
      bandwidthPricePerGb: Number(raw.bwGb ?? 0.01),
      storagePricePerGbMo: Number(raw.diskGbMo ?? 0.10),
      apiHealth: raw.status || 'HEALTHY',
      lastUpdated: new Date().toISOString(),
      historicalAvgPrice24h: hist24h,
      termsCompliant: raw.termsOk !== false,
      providerTermsNotes: raw.notes || '',
      supplyIndexScore: this.calculateSupplyIndex(raw),
      dataProvenance: isLive ? 'LIVE_API_VERIFIED' : 'FALLBACK_MARKET_FEED',
      isLiveApiVerified: isLive,
      liveApiSource: raw.source || (isLive ? 'LIVE_LAMBDA_API' : 'FALLBACK_MARKET_FEED')
    };
  }

  calculateSupplyIndex(raw: ProviderRawInstance): number {
    return computeSupplyIndexScore(raw.priceHr ?? 2, raw.uptimePct ?? 0.99, raw.type || 'on_demand', raw.bootSec ?? 30, raw.vram ?? 24);
  }

  checkCompliance(workloadType: string, _region: string): { compliant: boolean; reason?: string } {
    if (workloadType.toLowerCase().includes('abusive') || workloadType.toLowerCase().includes('botnet')) {
      return { compliant: false, reason: 'Violates Lambda Cloud Acceptable Use Policy' };
    }
    return { compliant: true };
  }

  // --- Programmatic Lambda Cloud Operations (OpenAPI 3.1.0) ---

  async listInstanceTypes(): Promise<Record<string, unknown>> {
    const res = await fetch('/api/providers/lambda/instance-types');
    return res.json();
  }

  async listInstances(): Promise<{ data: unknown[] }> {
    const res = await fetch('/api/providers/lambda/instances');
    return res.json();
  }

  async launchInstance(payload: LambdaInstanceLaunchPayload): Promise<{ success: boolean; data?: { instance_ids: string[] } }> {
    const res = await fetch('/api/providers/lambda/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async terminateInstance(instanceIds: string[]): Promise<{ success: boolean }> {
    const res = await fetch('/api/providers/lambda/terminate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_ids: instanceIds })
    });
    return res.json();
  }

  async restartInstance(instanceIds: string[]): Promise<{ success: boolean }> {
    const res = await fetch('/api/providers/lambda/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_ids: instanceIds })
    });
    return res.json();
  }

  async listRegions(): Promise<{ data: Array<{ name: string; description: string }> }> {
    const res = await fetch('/api/providers/lambda/regions');
    return res.json();
  }

  async listSSHKeys(): Promise<{ data: Array<{ id: string; name: string; public_key: string }> }> {
    const res = await fetch('/api/providers/lambda/ssh-keys');
    return res.json();
  }
}

// Provider Adapter Registry
export class ComputeProviderRegistry {
  private adapters: Map<ProviderId, IComputeProviderAdapter> = new Map();

  constructor() {
    // 3-Provider Architecture: Vast.ai + RunPod + Lambda Cloud
    this.register(new VastAiAdapter());
    this.register(new RunPodAdapter());
    this.register(new LambdaLabsAdapter());
  }

  register(adapter: IComputeProviderAdapter) {
    this.adapters.set(adapter.providerId, adapter);
  }

  getAdapter(providerId: ProviderId): IComputeProviderAdapter | undefined {
    return this.adapters.get(providerId);
  }

  getAllAdapters(): IComputeProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  async fetchAllNormalizedOffers(mode: 'LIVE' | 'PAPER' = 'PAPER'): Promise<ProviderOffer[]> {
    const adapterList = Array.from(this.adapters.values());
    const settled = await Promise.allSettled(
      adapterList.map(async adapter => {
        const rawList = await adapter.fetchRawOffers(mode);
        return rawList.map(raw => adapter.normalizeOffer(raw));
      })
    );
    const results: ProviderOffer[] = [];
    for (const item of settled) {
      if (item.status === 'fulfilled') {
        results.push(...item.value);
      }
    }
    return results;
  }
}

export const providerRegistry = new ComputeProviderRegistry();
