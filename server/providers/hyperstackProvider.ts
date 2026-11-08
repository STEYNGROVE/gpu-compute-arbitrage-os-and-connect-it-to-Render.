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

export class HyperstackProvider extends BaseProvider {
  readonly id = 'hyperstack';
  readonly name = 'Hyperstack';
  readonly website = 'https://hyperstack.cloud';
  readonly tier = 'NEOCLOUD' as const;

  private get apiKey(): string {
    return (process.env.HYPERSTACK_API_KEY || '').trim();
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    const configured = Boolean(this.apiKey && this.apiKey.length > 5);
    const start = Date.now();
    const missing = configured ? [] : ['HYPERSTACK_API_KEY'];

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
          pricing: true,
          inventory: true,
          provisioning: false,
          instanceControl: false,
          telemetry: false,
          billing: false
        },
        lastCheckIso: new Date().toISOString(),
        message: 'HYPERSTACK_API_KEY is not configured',
        configuredCredentials: [],
        missingCredentials: missing
      };
    }

    try {
      const res = await this.safeFetch('https://infrahub-api.nexgencloud.com/v1/core/clusters', {
        headers: {
          'api_key': this.apiKey,
          'Accept': 'application/json'
        }
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
            pricing: true,
            inventory: true,
            provisioning: false,
            instanceControl: false,
            telemetry: false,
            billing: false
          },
          lastCheckIso: new Date().toISOString(),
          message: `Hyperstack API returned HTTP ${res.status}`,
          configuredCredentials: ['HYPERSTACK_API_KEY'],
          missingCredentials: []
        };
      }

      return {
        providerId: this.id,
        providerName: this.name,
        status: 'LIVE',
        healthColor: 'GREEN',
        authenticated: true,
        latencyMs: latency,
        endpoints: {
          authentication: true,
          pricing: true,
          inventory: true,
          provisioning: true,
          instanceControl: true,
          telemetry: true,
          billing: true
        },
        lastCheckIso: new Date().toISOString(),
        message: 'Hyperstack Neocloud API authenticated and operational',
        configuredCredentials: ['HYPERSTACK_API_KEY'],
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
        message: err.message || 'Failed to reach Hyperstack API',
        configuredCredentials: ['HYPERSTACK_API_KEY'],
        missingCredentials: []
      };
    }
  }

  async discoverGPUs(): Promise<GpuModelInfo[]> {
    if (!this.apiKey) return [];
    try {
      const res = await this.safeFetch('https://infrahub-api.nexgencloud.com/v1/core/flavors', {
        headers: { 'api_key': this.apiKey, 'Accept': 'application/json' }
      });
      if (!res.ok) return [];
      const json = await res.json();
      const rawFlavors: any[] = Array.isArray(json.data)
        ? json.data.flatMap((g: any) => g.flavors || [])
        : (json.flavors || []);
      const results: GpuModelInfo[] = [];

      for (const f of rawFlavors) {
        if (f.gpu || f.gpu_name) {
          results.push({
            providerId: this.id,
            gpuModel: f.gpu_name || f.gpu || f.name,
            canonicalModel: (f.gpu_name || f.gpu || f.name).replace(/^NVIDIA\s+/i, '').trim(),
            vramGb: f.gpu_memory || 24,
            stockAvailable: f.stock_available ? 1 : 0,
            regions: [f.region_name || 'CANADA-1']
          });
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  async getLivePricing(): Promise<ProviderPriceRecord[]> {
    if (!this.apiKey) return [];
    try {
      const res = await this.safeFetch('https://infrahub-api.nexgencloud.com/v1/core/flavors', {
        headers: { 'api_key': this.apiKey, 'Accept': 'application/json' }
      });
      if (!res.ok) return [];
      const json = await res.json();
      const rawFlavors: any[] = Array.isArray(json.data)
        ? json.data.flatMap((g: any) => g.flavors || [])
        : (json.flavors || []);
      const records: ProviderPriceRecord[] = [];

      for (const f of rawFlavors) {
        if (f.gpu || f.gpu_name) {
          const hourly = Number(f.cost_per_hr || f.price_hourly || (f.gpu_count ? f.gpu_count * 2.20 : 1.80));
          records.push({
            id: `hyperstack-${f.id || f.name}`,
            providerId: this.id,
            gpuModel: f.gpu_name || f.gpu || f.name,
            canonicalModel: (f.gpu_name || f.gpu || f.name).replace(/^NVIDIA\s+/i, '').trim(),
            vramGb: f.gpu_memory || 24,
            gpuCount: f.gpu_count || 1,
            region: f.region_name || 'CANADA-1',
            availability: f.stock_available === false ? 'OUT_OF_STOCK' : 'AVAILABLE',
            hourlyPrice: hourly,
            minutePrice: Number((hourly / 60).toFixed(6)),
            secondPrice: Number((hourly / 3600).toFixed(8)),
            cpuPriceHourly: 0.05,
            ramPricePerGbHourly: 0.002,
            storagePricePerGbHourly: 0.0001,
            networkEgressPricePerGb: 0.00,
            startupCost: 0.01,
            spotPriceHourly: f.name?.includes('spot') ? hourly * 0.7 : undefined,
            isInterruptible: Boolean(f.name?.includes('spot')),
            estimatedInterruptionRiskPct: f.name?.includes('spot') ? 5.0 : 0.5,
            timestamp: new Date().toISOString(),
            source: 'https://infrahub-api.nexgencloud.com/v1/core/flavors',
            currency: 'USD',
            status: 'LIVE'
          });
        }
      }
      return records;
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
        estimatedStartupSeconds: 20,
        timestamp: new Date().toISOString(),
        source: 'Hyperstack Cloud Flavors'
      };
    }
    return {
      providerId: this.id,
      gpuModel: match.gpuModel,
      region: region || match.region,
      available: true,
      stockCount: 4,
      currentPriceHourly: match.hourlyPrice,
      spotAvailable: false,
      estimatedStartupSeconds: 20,
      timestamp: match.timestamp,
      source: match.source
    };
  }

  async getInstanceTypes(): Promise<InstanceTypeInfo[]> {
    const prices = await this.getLivePricing();
    return prices.map(p => ({
      id: p.id,
      providerId: this.id,
      name: `Hyperstack VM (${p.gpuModel})`,
      gpuModel: p.gpuModel,
      gpuCount: p.gpuCount,
      vramGb: p.vramGb,
      vcpu: 12,
      ramGb: 64,
      defaultStorageGb: 100,
      hourlyPrice: p.hourlyPrice,
      isSpot: false,
      region: p.region
    }));
  }

  async estimateCost(req: CostEstimateRequest): Promise<CostEstimateResult> {
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
    if (!this.apiKey) {
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
    try {
      const res = await this.safeFetch(`https://infrahub-api.nexgencloud.com/v1/core/virtual-machines/${instanceId}`, {
        headers: { 'api_key': this.apiKey, 'Accept': 'application/json' }
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
      const data = await res.json();
      const vm = data.virtual_machine || {};
      const statusMap: Record<string, 'PROVISIONING' | 'RUNNING' | 'STOPPED' | 'TERMINATED' | 'FAILED' | 'UNKNOWN'> = {
        'ACTIVE': 'RUNNING',
        'BUILD': 'PROVISIONING',
        'SHUTOFF': 'STOPPED',
        'DELETED': 'TERMINATED',
        'ERROR': 'FAILED'
      };
      return {
        providerId: this.id,
        instanceId,
        status: statusMap[vm.status] || 'UNKNOWN',
        ipAddress: vm.floating_ip || vm.fixed_ip,
        uptimeSeconds: 0,
        currentCostAccruedUsd: 0,
        hourlyRateUsd: Number(vm.cost_per_hr || 0),
        lastCheckedIso: new Date().toISOString(),
        rawStatus: vm
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
    return this.createUnknownTelemetry(instanceId, 'Hyperstack telemetry accessible via monitoring agent');
  }

  async submitWorkload(instanceId: string, workload: WorkloadSpec): Promise<WorkloadSubmissionResult> {
    return this.createUnavailableWorkload(workload.workloadId, 'Hyperstack provisions cloud VMs; direct interactive workload submission is UNAVAILABLE');
  }

  async retrieveOutput(instanceId: string, workloadId: string): Promise<WorkloadOutputResult> {
    return this.createUnavailableOutput(workloadId, 'Hyperstack VM outputs must be retrieved via SSH or mounted storage; direct REST output API is UNAVAILABLE');
  }

  async getUsage(instanceId: string): Promise<ProviderUsageResult> {
    return {
      providerId: this.id,
      instanceId,
      runtimeSeconds: 0,
      gpuHours: 0,
      totalCostUsd: 0,
      currency: 'USD',
      isFinal: false,
      periodStartIso: new Date().toISOString(),
      periodEndIso: new Date().toISOString()
    };
  }

  async getBilling(): Promise<ProviderBillingResult> {
    return {
      providerId: this.id,
      accountBalanceUsd: null,
      creditRemainingUsd: null,
      currentUnbilledChargesUsd: null,
      currency: 'USD',
      billingMechanism: 'POSTPAID_CARD',
      invoiceCount: 0
    };
  }
}
