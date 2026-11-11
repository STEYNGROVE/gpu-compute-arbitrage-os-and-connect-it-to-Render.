import { BaseProvider } from './baseProvider.js';
import {
  GpuModelInfo,
  ProviderPriceRecord,
  ProviderAvailability,
  InstanceTypeInfo,
  CostEstimateRequest,
  CostEstimateResult,
  ProvisionRequest,
  ProvisionResult,
  InstanceActionResult,
  InstanceStatusResult,
  ProviderTelemetryResult,
  WorkloadSpec,
  WorkloadSubmissionResult,
  WorkloadOutputResult,
  ProviderUsageResult,
  ProviderBillingResult,
  ProviderHealthResult
} from './types.js';

/** Inject read-only transport and credentials for deterministic offline contract tests. */
export type RunpodReadDependencies = {
  apiKey?: () => string;
  request?: (url: string, options: RequestInit) => Promise<Response>;
};

export class RunpodProvider extends BaseProvider {
  constructor(private readonly dependencies: RunpodReadDependencies = {}) { super(); }

  private readRequest(url: string, options: RequestInit): Promise<Response> {
    return this.dependencies.request ? this.dependencies.request(url, options) : this.safeFetch(url, options);
  }

  readonly id = 'runpod';
  readonly name = 'RunPod';
  readonly website = 'https://runpod.io';
  readonly tier = 'NEOCLOUD' as const;

  private get apiKey(): string {
    return (this.dependencies.apiKey ? this.dependencies.apiKey() : process.env.RUNPOD_API_KEY || '').trim();
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    const configured = Boolean(this.apiKey && this.apiKey.length > 5);
    const start = Date.now();
    const missing = configured ? [] : ['RUNPOD_API_KEY'];
    const configuredKeys = configured ? ['RUNPOD_API_KEY'] : [];

    if (!configured) {
      return {
        providerId: this.id,
        providerName: this.name,
        status: 'CONFIGURATION_REQUIRED',
        healthColor: 'GREY',
        authenticated: false,
        latencyMs: 0,
        endpoints: {
          authentication: false,
          pricing: false,
          inventory: false,
          provisioning: false,
          instanceControl: false,
          telemetry: false,
          billing: false
        },
        lastCheckIso: new Date().toISOString(),
        message: 'RUNPOD_API_KEY is not configured',
        configuredCredentials: configuredKeys,
        missingCredentials: missing
      };
    }

    try {
      const res = await this.readRequest('https://api.runpod.io/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ query: 'query { myself { id clientBalance } }' })
      });
      const latency = Date.now() - start;

      if (!res.ok) {
        return {
          providerId: this.id,
          providerName: this.name,
          status: 'ERROR',
          healthColor: 'RED',
          authenticated: false,
          latencyMs: latency,
          endpoints: {
            authentication: false,
            pricing: false,
            inventory: false,
            provisioning: false,
            instanceControl: false,
            telemetry: false,
            billing: false
          },
          lastCheckIso: new Date().toISOString(),
          message: `RunPod GraphQL endpoint returned HTTP ${res.status}`,
          configuredCredentials: configuredKeys,
          missingCredentials: []
        };
      }

      const body = await res.json();
      const me = body.data?.myself;
      const authenticated = !(body.errors && (!Array.isArray(body.errors) || body.errors.length > 0)) &&
        typeof me?.id === 'string' && me.id.trim().length > 0;

      return {
        providerId: this.id,
        providerName: this.name,
        status: authenticated ? 'AUTHENTICATED' : 'UNVERIFIED',
        healthColor: authenticated ? 'GREEN' : 'YELLOW',
        authenticated,
        latencyMs: latency,
        endpoints: {
          authentication: authenticated,
          pricing: false,
          inventory: false,
          provisioning: false,
          instanceControl: false,
          telemetry: false,
          billing: false
        },
        lastCheckIso: new Date().toISOString(),
        message: authenticated ? 'Identity verified; inventory and execution not independently verified' : 'RunPod query returned without user identity',
        configuredCredentials: configuredKeys,
        missingCredentials: []
      };
    } catch (err: any) {
      return {
        providerId: this.id,
        providerName: this.name,
        status: 'UNAVAILABLE',
        healthColor: 'RED',
        authenticated: false,
        latencyMs: Date.now() - start,
        endpoints: {
          authentication: false,
          pricing: false,
          inventory: false,
          provisioning: false,
          instanceControl: false,
          telemetry: false,
          billing: false
        },
        lastCheckIso: new Date().toISOString(),
        message: err.message || 'Failed to reach RunPod GraphQL API',
        configuredCredentials: configuredKeys,
        missingCredentials: []
      };
    }
  }

  async discoverGPUs(): Promise<GpuModelInfo[]> {
    if (!this.apiKey) return [];
    try {
      const res = await this.readRequest('https://api.runpod.io/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          query: `query { gpuTypes { id displayName memoryInGb securePrice lowestPrice { minimumBidPrice uninterruptablePrice } } }`
        })
      });
      if (!res.ok) return [];
      const json = await res.json();
      const gpus: any[] = json.data?.gpuTypes || [];

      return gpus.map(g => ({
        providerId: this.id,
        gpuModel: g.displayName || g.id,
        canonicalModel: (g.displayName || g.id).replace(/^NVIDIA\s+/i, '').trim(),
        vramGb: g.memoryInGb || 24,
        stockAvailable: 0,
        regions: []
      }));
    } catch {
      return [];
    }
  }

  async getLivePricing(): Promise<ProviderPriceRecord[]> {
    if (!this.apiKey) return [];
    try {
      const res = await this.readRequest('https://api.runpod.io/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          query: `query { gpuTypes { id displayName memoryInGb securePrice lowestPrice { minimumBidPrice uninterruptablePrice } } }`
        })
      });
      if (!res.ok) return [];
      const json = await res.json();
      const gpus: any[] = json.data?.gpuTypes || [];

      return gpus.map(g => {
        const hourly = Number(g.lowestPrice?.uninterruptablePrice || g.securePrice || 0);
        const spot = g.lowestPrice?.minimumBidPrice == null ? undefined : Number(g.lowestPrice.minimumBidPrice);
        const name = g.displayName || g.id;
        return {
          id: `runpod-${g.id}`,
          providerId: this.id,
          gpuModel: name,
          canonicalModel: name.replace(/^NVIDIA\s+/i, '').trim(),
          vramGb: g.memoryInGb || 24,
          gpuCount: 1,
          region: 'SECURE_CLOUD',
          availability: 'UNKNOWN',
          hourlyPrice: hourly,
          minutePrice: hourly > 0 ? Number((hourly / 60).toFixed(6)) : undefined,
          secondPrice: hourly > 0 ? Number((hourly / 3600).toFixed(8)) : undefined,
          cpuPriceHourly: Number((hourly * 0.08).toFixed(4)),
          ramPricePerGbHourly: 0.003,
          storagePricePerGbHourly: 0.0001,
          networkEgressPricePerGb: 0.005,
          startupCost: 0.01,
          spotPriceHourly: spot !== undefined && Number.isFinite(spot) && spot > 0 ? spot : undefined,
          isInterruptible: spot !== undefined && Number.isFinite(spot) && spot > 0 && spot < hourly,
          estimatedInterruptionRiskPct: 8.5,
          timestamp: new Date().toISOString(),
          source: 'https://api.runpod.io/graphql (gpuTypes)',
          currency: 'USD',
          status: 'STALE',
          rawReference: { gpu_id: g.id, pricingVerification: 'GPU_QUOTE_ONLY', ancillaryCostsVerified: false, executable: false }
        };
      });
    } catch {
      return [];
    }
  }

  async getAvailability(gpuModel: string, region?: string): Promise<ProviderAvailability> {
    const prices = await this.getLivePricing();
    const match = prices.find(p => p.gpuModel.toLowerCase().includes(gpuModel.toLowerCase()));
    if (!match) {
      return {
        providerId: this.id,
        gpuModel,
        region,
        available: false,
        stockCount: 0,
        currentPriceHourly: 0,
        spotAvailable: false,
        estimatedStartupSeconds: 15,
        timestamp: new Date().toISOString(),
        source: 'RunPod GraphQL'
      };
    }
    return {
      providerId: this.id,
      gpuModel: match.gpuModel,
      region: region || match.region,
      available: false,
      stockCount: 0,
      currentPriceHourly: match.hourlyPrice,
      spotAvailable: match.isInterruptible,
      spotPriceHourly: match.spotPriceHourly,
      estimatedStartupSeconds: 15,
      timestamp: match.timestamp,
      source: match.source
    };
  }

  async getInstanceTypes(): Promise<InstanceTypeInfo[]> {
    const prices = await this.getLivePricing();
    return prices.slice(0, 30).map(p => ({
      id: p.id,
      providerId: this.id,
      name: `RunPod 1x ${p.gpuModel}`,
      gpuModel: p.gpuModel,
      gpuCount: 1,
      vramGb: p.vramGb,
      vcpu: 8,
      ramGb: 32,
      defaultStorageGb: 50,
      hourlyPrice: p.hourlyPrice,
      isSpot: p.isInterruptible,
      region: p.region
    }));
  }

  async estimateCost(_req: CostEstimateRequest): Promise<CostEstimateResult> {
    throw new Error('COST_UNVERIFIED: full provider fees, storage, network, and payment costs are not independently verified');
  }

  async provision(req: ProvisionRequest): Promise<ProvisionResult> {
    return { success: false, providerId: this.id, status: 'REJECTED', actualHourlyPriceUsd: 0, error: 'READ_ONLY: GPU provisioning disabled', provisionedAtIso: new Date().toISOString() };
  }

  async start(instanceId: string): Promise<InstanceActionResult> {
    return { success: false, providerId: this.id, instanceId, action: 'START', resultingStatus: 'FAILED', timestamp: new Date().toISOString() };
  }

  async stop(instanceId: string): Promise<InstanceActionResult> {
    return { success: false, providerId: this.id, instanceId, action: 'STOP', resultingStatus: 'FAILED', timestamp: new Date().toISOString() };
  }

  async restart(instanceId: string): Promise<InstanceActionResult> {
    return { success: false, providerId: this.id, instanceId, action: 'RESTART', resultingStatus: 'FAILED', timestamp: new Date().toISOString() };
  }

  async terminate(instanceId: string): Promise<InstanceActionResult> {
    return { success: false, providerId: this.id, instanceId, action: 'TERMINATE', resultingStatus: 'FAILED', timestamp: new Date().toISOString() };
  }

  async getInstanceStatus(instanceId: string): Promise<InstanceStatusResult> {
    if (!this.apiKey) throw new Error('RUNPOD_API_KEY not configured');
    try {
      const query = `query { pod(input: { podId: ${JSON.stringify(instanceId)} }) { id desiredStatus actualStatus runtime { uptimeInSeconds ports { ip isIpPublic privatePort publicPort } } costPerHr } }`;
      const res = await this.readRequest('https://api.runpod.io/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
        body: JSON.stringify({ query })
      });
      if (!res.ok) {
        return {
          providerId: this.id,
          instanceId,
          status: 'UNKNOWN',
          uptimeSeconds: 0,
          currentCostAccruedUsd: 0,
          hourlyRateUsd: 0,
          lastCheckedIso: new Date().toISOString()
        };
      }
      const json = await res.json();
      const pod = json.data?.pod;
      const uptime = Number(pod?.runtime?.uptimeInSeconds || 0);
      const hourly = Number(pod?.costPerHr || 0);
      return {
        providerId: this.id,
        instanceId,
        status: pod?.actualStatus === 'RUNNING' ? 'RUNNING' : pod?.actualStatus === 'STOPPED' ? 'STOPPED' : 'UNKNOWN',
        ipAddress: pod?.runtime?.ports?.[0]?.ip,
        uptimeSeconds: uptime,
        currentCostAccruedUsd: Number(((uptime / 3600) * hourly).toFixed(4)),
        hourlyRateUsd: hourly,
        lastCheckedIso: new Date().toISOString(),
        rawStatus: pod
      };
    } catch {
      return {
        providerId: this.id,
        instanceId,
        status: 'UNKNOWN',
        uptimeSeconds: 0,
        currentCostAccruedUsd: 0,
        hourlyRateUsd: 0,
        lastCheckedIso: new Date().toISOString()
      };
    }
  }

  async getTelemetry(instanceId: string): Promise<ProviderTelemetryResult> {
    if (!this.apiKey) return this.createUnknownTelemetry(instanceId, 'RUNPOD_API_KEY not configured');
    const status = await this.getInstanceStatus(instanceId);
    if (status.status !== 'RUNNING') {
      return this.createUnknownTelemetry(instanceId, 'Pod is not running');
    }
    // Return verified status with UNKNOWN metric fields unless real metrics are returned
    return {
      providerId: this.id,
      instanceId,
      timestamp: new Date().toISOString(),
      isVerified: true,
      source: 'PROVIDER_API',
      gpuUtilizationPct: null, // Unknown without agent probe
      gpuTemperatureC: null,
      vramUsedGb: null,
      vramTotalGb: null,
      powerWatts: null,
      cpuUtilizationPct: null,
      ramUsedGb: null,
      diskUsedGb: null,
      networkInMbps: null,
      networkOutMbps: null,
      accruedCostUsd: status.currentCostAccruedUsd,
      errorCount: 0,
      rawTelemetry: { podId: instanceId, status: status.status }
    };
  }

  async submitWorkload(_instanceId: string, workload: WorkloadSpec): Promise<WorkloadSubmissionResult> {
    return this.createUnavailableWorkload(workload.workloadId, 'READ_ONLY: workload submission disabled');
  }

  async retrieveOutput(_instanceId: string, workloadId: string): Promise<WorkloadOutputResult> {
    return this.createUnavailableOutput(
      workloadId,
      'READ_ONLY: no verified workload output evidence'
    );
  }

  async getUsage(_instanceId: string): Promise<ProviderUsageResult> {
    throw new Error(
      'USAGE_UNVERIFIED: provider-confirmed usage required'
    );
  }

  async getBilling(): Promise<ProviderBillingResult> {
    if (!this.apiKey) {
      return {
        providerId: this.id,
        accountBalanceUsd: null,
        creditRemainingUsd: null,
        currentUnbilledChargesUsd: null,
        currency: 'USD',
        billingMechanism: 'PREPAID_CREDIT',
        invoiceCount: 0
      };
    }
    try {
      const res = await this.readRequest('https://api.runpod.io/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
        body: JSON.stringify({ query: 'query { myself { id clientBalance } }' })
      });
      if (!res.ok) {
        return {
          providerId: this.id,
          accountBalanceUsd: null,
          creditRemainingUsd: null,
          currentUnbilledChargesUsd: null,
          currency: 'USD',
          billingMechanism: 'PREPAID_CREDIT',
          invoiceCount: 0
        };
      }
      const json = await res.json();
      const me = json.data?.myself;
      const bal = me?.clientBalance;
      if ((json.errors && (!Array.isArray(json.errors) || json.errors.length > 0)) ||
          typeof me?.id !== 'string' || !me.id.trim() ||
          typeof bal !== 'number' || !Number.isFinite(bal) || bal < 0 || bal >= 100000000) {
        throw new Error('BALANCE_SCHEMA_UNVERIFIED');
      }
      return {
        providerId: this.id,
        accountBalanceUsd: bal,
        creditRemainingUsd: bal,
        currentUnbilledChargesUsd: null,
        currency: 'USD',
        billingMechanism: 'PREPAID_CREDIT',
        invoiceCount: 0,
        rawBillingInfo: {
          balanceVerifiedFromProviderResponse: true,
          invoiceCountVerified: false,
          procurementAuthorized: false
        }
      };
    } catch {
      return {
        providerId: this.id,
        accountBalanceUsd: null,
        creditRemainingUsd: null,
        currentUnbilledChargesUsd: null,
        currency: 'USD',
        billingMechanism: 'PREPAID_CREDIT',
        invoiceCount: 0
      };
    }
  }
}
