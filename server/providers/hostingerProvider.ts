import { BaseProvider } from "./baseProvider.js";
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
  ProviderHealthResult,
} from "./types.js";

export class HostingerProvider extends BaseProvider {
  readonly id = "hostinger";
  readonly name = "Hostinger GPU";
  readonly website = "https://hostinger.com/vps/gpu";
  readonly tier = "NEOCLOUD" as const;

  private get apiKey(): string {
    return (
      process.env.HOSTINGER_API_KEY ||
      process.env.HOSTINGER_API_TOKEN ||
      ""
    ).trim();
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    const configured = Boolean(this.apiKey && this.apiKey.length > 5);
    const start = Date.now();
    const missing = configured ? [] : ["HOSTINGER_API_KEY"];

    if (!configured) {
      return {
        providerId: this.id,
        providerName: this.name,
        status: "CONFIGURATION_REQUIRED",
        healthColor: "GREY",
        authenticated: false,
        latencyMs: 0,
        endpoints: {
          authentication: false,
          pricing: true,
          inventory: true,
          provisioning: false,
          instanceControl: false,
          telemetry: false,
          billing: false,
        },
        lastCheckIso: new Date().toISOString(),
        message: "HOSTINGER_API_KEY is not configured",
        configuredCredentials: [],
        missingCredentials: missing,
      };
    }

    try {
      const res = await this.safeFetch(
        "https://api.hostinger.com/v1/vps/servers",
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json",
          },
        },
      );
      const latency = Date.now() - start;

      if (!res.ok) {
        return {
          providerId: this.id,
          providerName: this.name,
          status: "ERROR",
          healthColor: "RED",
          authenticated: false,
          latencyMs: latency,
          endpoints: {
            authentication: false,
            pricing: true,
            inventory: true,
            provisioning: false,
            instanceControl: false,
            telemetry: false,
            billing: false,
          },
          lastCheckIso: new Date().toISOString(),
          message: `Hostinger VPS API returned HTTP ${res.status}`,
          configuredCredentials: ["HOSTINGER_API_KEY"],
          missingCredentials: [],
        };
      }

      return {
        providerId: this.id,
        providerName: this.name,
        status: "LIVE",
        healthColor: "GREEN",
        authenticated: true,
        latencyMs: latency,
        endpoints: {
          authentication: true,
          pricing: true,
          inventory: true,
          provisioning: true,
          instanceControl: true,
          telemetry: true,
          billing: true,
        },
        lastCheckIso: new Date().toISOString(),
        message: "Hostinger Cloud VPS API authenticated and operational",
        configuredCredentials: ["HOSTINGER_API_KEY"],
        missingCredentials: [],
      };
    } catch (err: any) {
      return {
        providerId: this.id,
        providerName: this.name,
        status: "UNAVAILABLE",
        healthColor: "RED",
        authenticated: false,
        latencyMs: Date.now() - start,
        endpoints: {
          authentication: false,
          pricing: false,
          inventory: false,
          provisioning: false,
          instanceControl: false,
          telemetry: false,
          billing: false,
        },
        lastCheckIso: new Date().toISOString(),
        message: err.message || "Failed to reach Hostinger API",
        configuredCredentials: ["HOSTINGER_API_KEY"],
        missingCredentials: [],
      };
    }
  }

  async discoverGPUs(): Promise<GpuModelInfo[]> {
    if (!this.apiKey) return [];
    try {
      const res = await this.safeFetch(
        "https://api.hostinger.com/v1/vps/catalog",
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json",
          },
        },
      );
      if (!res.ok) return [];
      const json = await res.json();
      const plans = json.plans || json.data || [];
      return plans.map((p: any) => ({
        providerId: this.id,
        gpuModel: p.name || "Hostinger GPU VPS",
        canonicalModel: (p.name || "GPU VPS").replace(/^NVIDIA\s+/i, "").trim(),
        vramGb: p.gpu_ram_gb || null,
        stockAvailable: p.in_stock === false ? 0 : null,
        regions: p.datacenters || ["US-CENTRAL"],
      }));
    } catch {
      return [];
    }
  }

  async getLivePricing(): Promise<ProviderPriceRecord[]> {
    if (!this.apiKey) return [];
    try {
      const res = await this.safeFetch(
        "https://api.hostinger.com/v1/vps/catalog",
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json",
          },
        },
      );
      if (!res.ok) return [];
      const json = await res.json();
      const plans = json.plans || json.data || [];
      const records: ProviderPriceRecord[] = [];

      for (const p of plans) {
        const hourly = Number(
          p.price_hourly || p.price_per_month ? p.price_per_month / 720 : 0,
        );
        if (hourly > 0) {
          records.push({
            id: `hostinger-${p.id || p.sku}`,
            providerId: this.id,
            gpuModel: p.name || "Hostinger GPU VPS",
            canonicalModel: (p.name || "GPU VPS")
              .replace(/^NVIDIA\s+/i, "")
              .trim(),
            vramGb: p.gpu_ram_gb || null,
            gpuCount: p.gpu_count || 1,
            region: p.datacenter || "US-CENTRAL",
            availability: p.in_stock ? "AVAILABLE" : "OUT_OF_STOCK",
            hourlyPrice: hourly,
            minutePrice: Number((hourly / 60).toFixed(6)),
            secondPrice: Number((hourly / 3600).toFixed(8)),
            cpuPriceHourly: 0.03,
            ramPricePerGbHourly: 0.0015,
            storagePricePerGbHourly: 0.0001,
            networkEgressPricePerGb: 0.0,
            startupCost: 0.01,
            spotPriceHourly: undefined,
            isInterruptible: false,
            estimatedInterruptionRiskPct: 0.1,
            timestamp: new Date().toISOString(),
            source: "https://api.hostinger.com/v1/vps/catalog",
            currency: "USD",
            status: "LIVE",
          });
        }
      }
      return this.catalogOnly(records);
    } catch {
      return [];
    }
  }

  async getAvailability(
    gpuModel: string,
    region?: string,
  ): Promise<ProviderAvailability> {
    const prices = await this.getLivePricing();
    const match = prices.find((p) =>
      p.gpuModel.toLowerCase().includes(gpuModel.toLowerCase()),
    );
    if (!match) {
      return {
        providerId: this.id,
        gpuModel,
        region,
        available: false,
        stockCount: 0,
        currentPriceHourly: 0,
        spotAvailable: false,
        estimatedStartupSeconds: 25,
        timestamp: new Date().toISOString(),
        source: "Hostinger Cloud VPS",
      };
    }
    return {
      providerId: this.id,
      gpuModel: match.gpuModel,
      region: region || match.region,
      available: true,
      stockCount: null,
      currentPriceHourly: match.hourlyPrice,
      spotAvailable: false,
      estimatedStartupSeconds: 25,
      timestamp: match.timestamp,
      source: match.source,
    };
  }

  async getInstanceTypes(): Promise<InstanceTypeInfo[]> {
    const prices = await this.getLivePricing();
    return prices.map((p) => ({
      id: p.id,
      providerId: this.id,
      name: `Hostinger Dedicated (${p.gpuModel})`,
      gpuModel: p.gpuModel,
      gpuCount: p.gpuCount,
      vramGb: p.vramGb,
      vcpu: 8,
      ramGb: 32,
      defaultStorageGb: 100,
      hourlyPrice: p.hourlyPrice,
      isSpot: false,
      region: p.region,
    }));
  }

  async estimateCost(req: CostEstimateRequest): Promise<CostEstimateResult> {
    throw new Error(
      "COST_UNVERIFIED: full provider fees, storage, network, and payment costs are not independently verified",
    );
  }

  async provision(req: ProvisionRequest): Promise<ProvisionResult> {
    return {
      success: false,
      providerId: this.id,
      status: "REJECTED",
      actualHourlyPriceUsd: 0,
      error: "READ_ONLY: GPU provisioning disabled",
      provisionedAtIso: new Date().toISOString(),
    };
  }

  async start(instanceId: string): Promise<InstanceActionResult> {
    return {
      success: false,
      providerId: this.id,
      instanceId,
      action: "START",
      resultingStatus: "FAILED",
      timestamp: new Date().toISOString(),
    };
  }

  async stop(instanceId: string): Promise<InstanceActionResult> {
    return {
      success: false,
      providerId: this.id,
      instanceId,
      action: "STOP",
      resultingStatus: "FAILED",
      timestamp: new Date().toISOString(),
    };
  }

  async restart(instanceId: string): Promise<InstanceActionResult> {
    return {
      success: false,
      providerId: this.id,
      instanceId,
      action: "RESTART",
      resultingStatus: "FAILED",
      timestamp: new Date().toISOString(),
    };
  }

  async terminate(instanceId: string): Promise<InstanceActionResult> {
    return {
      success: false,
      providerId: this.id,
      instanceId,
      action: "TERMINATE",
      resultingStatus: "FAILED",
      timestamp: new Date().toISOString(),
    };
  }

  async getInstanceStatus(instanceId: string): Promise<InstanceStatusResult> {
    if (!this.apiKey) {
      return {
        providerId: this.id,
        instanceId,
        status: "UNKNOWN",
        uptimeSeconds: 0,
        currentCostAccruedUsd: 0,
        hourlyRateUsd: 0,
        lastCheckedIso: new Date().toISOString(),
      };
    }
    try {
      const res = await this.safeFetch(
        `https://api.hostinger.com/v1/vps/${instanceId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json",
          },
        },
      );
      if (!res.ok) {
        return {
          providerId: this.id,
          instanceId,
          status: "UNKNOWN",
          uptimeSeconds: 0,
          currentCostAccruedUsd: 0,
          hourlyRateUsd: 0,
          lastCheckedIso: new Date().toISOString(),
        };
      }
      const data = await res.json();
      return {
        providerId: this.id,
        instanceId,
        status:
          data.status === "running"
            ? "RUNNING"
            : data.status === "stopped"
              ? "STOPPED"
              : "UNKNOWN",
        ipAddress: data.ip_address,
        uptimeSeconds: 0,
        currentCostAccruedUsd: 0,
        hourlyRateUsd: Number(data.hourly_rate || 0),
        lastCheckedIso: new Date().toISOString(),
        rawStatus: data,
      };
    } catch {
      return {
        providerId: this.id,
        instanceId,
        status: "UNKNOWN",
        uptimeSeconds: 0,
        currentCostAccruedUsd: 0,
        hourlyRateUsd: 0,
        lastCheckedIso: new Date().toISOString(),
      };
    }
  }

  async getTelemetry(instanceId: string): Promise<ProviderTelemetryResult> {
    return this.createUnknownTelemetry(
      instanceId,
      "Hostinger telemetry accessible via cPanel/cloud monitoring API",
    );
  }

  async submitWorkload(
    instanceId: string,
    workload: WorkloadSpec,
  ): Promise<WorkloadSubmissionResult> {
    return this.createUnavailableWorkload(
      workload.workloadId,
      "Hostinger provisions VPS instances; direct interactive workload submission is UNAVAILABLE",
    );
  }

  async retrieveOutput(
    instanceId: string,
    workloadId: string,
  ): Promise<WorkloadOutputResult> {
    return this.createUnavailableOutput(
      workloadId,
      "Hostinger VPS outputs must be retrieved via SSH; direct REST output API is UNAVAILABLE",
    );
  }

  async getUsage(instanceId: string): Promise<ProviderUsageResult> {
    return {
      providerId: this.id,
      instanceId,
      runtimeSeconds: 0,
      gpuHours: 0,
      totalCostUsd: 0,
      currency: "USD",
      isFinal: false,
      periodStartIso: new Date().toISOString(),
      periodEndIso: new Date().toISOString(),
    };
  }

  async getBilling(): Promise<ProviderBillingResult> {
    return {
      providerId: this.id,
      accountBalanceUsd: null,
      creditRemainingUsd: null,
      currentUnbilledChargesUsd: null,
      currency: "USD",
      billingMechanism: "PREPAID_CREDIT",
      invoiceCount: 0,
    };
  }
}
