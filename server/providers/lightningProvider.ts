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

export class LightningProvider extends BaseProvider {
  readonly id = "lightning_ai";
  readonly name = "Lightning AI Studios";
  readonly website =
    "https://lightning.ai/steyngrovesar-org/dashboard/teamspaces";
  readonly tier = "NEOCLOUD" as const;

  private get userId(): string {
    return (process.env.LIGHTNING_USER_ID || "").trim();
  }

  private get apiKey(): string {
    return (process.env.LIGHTNING_API_KEY || "").trim();
  }

  private get orgId(): string {
    return (process.env.LIGHTNING_ORG_ID || "steyngrovesar-org").trim();
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    const hasKey = Boolean(this.apiKey && this.apiKey.length > 5);
    const hasUser = Boolean(this.userId && this.userId.length > 2);
    const hasOrg = Boolean(this.orgId && this.orgId.length > 2);
    const start = Date.now();

    const missing: string[] = [];
    if (!hasKey) missing.push("LIGHTNING_API_KEY");
    if (!hasUser) missing.push("LIGHTNING_USER_ID");
    if (!hasOrg) missing.push("LIGHTNING_ORG_ID");

    const configured = hasKey && hasUser;

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
          pricing: false,
          inventory: false,
          provisioning: false,
          instanceControl: false,
          telemetry: false,
          billing: false,
        },
        lastCheckIso: new Date().toISOString(),
        message: `Missing Lightning AI credentials: ${missing.join(", ")}`,
        configuredCredentials: ["LIGHTNING_ORG_ID: " + this.orgId],
        missingCredentials: missing,
      };
    }

    try {
      const res = await this.safeFetch("https://lightning.ai/v1/memberships", {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      });
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
            pricing: false,
            inventory: false,
            provisioning: false,
            instanceControl: false,
            telemetry: false,
            billing: false,
          },
          lastCheckIso: new Date().toISOString(),
          message: `Lightning AI API returned HTTP ${res.status}`,
          configuredCredentials: [
            "LIGHTNING_USER_ID",
            "LIGHTNING_API_KEY",
            "LIGHTNING_ORG_ID",
          ],
          missingCredentials: [],
        };
      }

      const body = await res.json();
      const authenticated =
        Array.isArray(body.memberships) && body.memberships.length > 0;
      const bal =
        authenticated && typeof body.memberships[0]?.balance === "number"
          ? body.memberships[0].balance
          : null;

      return {
        providerId: this.id,
        providerName: this.name,
        status: authenticated ? "LIVE" : "AUTHENTICATED",
        healthColor: authenticated ? "GREEN" : "YELLOW",
        authenticated: Boolean(authenticated),
        latencyMs: latency,
        endpoints: {
          authentication: true,
          pricing: false,
          inventory: true,
          provisioning: true,
          instanceControl: true,
          telemetry: true,
          billing: true,
        },
        lastCheckIso: new Date().toISOString(),
        message: authenticated
          ? `Authenticated to Lightning AI Studios (${this.orgId || "Teamspace"})${bal !== null ? ` — Balance: $${bal.toFixed(2)}` : ""}`
          : "Connected without user confirmation",
        configuredCredentials: [
          "LIGHTNING_USER_ID",
          "LIGHTNING_API_KEY",
          "LIGHTNING_ORG_ID",
        ],
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
        message: err.message || "Failed to reach Lightning AI API",
        configuredCredentials: [
          "LIGHTNING_USER_ID",
          "LIGHTNING_API_KEY",
          "LIGHTNING_ORG_ID",
        ],
        missingCredentials: [],
      };
    }
  }

  async discoverGPUs(): Promise<GpuModelInfo[]> {
    if (!this.apiKey || !this.userId) return [];

    try {
      const res = await this.safeFetch(
        "https://lightning.ai/api/v1/hardware-types",
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "X-Lightning-User-Id": this.userId,
            "X-Lightning-Org-Id": this.orgId,
          },
        },
      );
      if (res.ok) {
        const json = await res.json();
        const hardwareList = json.hardware || [];
        if (hardwareList.length > 0) {
          return hardwareList.map((h: any) => ({
            providerId: this.id,
            gpuModel: h.name || "Lightning Studio Hardware",
            canonicalModel: (h.name || "").replace(/^NVIDIA\s+/i, "").trim(),
            vramGb: h.vram_gb || null,
            stockAvailable: h.available_count ?? null,
            regions: [`Lightning Teamspace (${this.orgId})`],
          }));
        }
      }
    } catch {}

    return [];
  }

  // No current account-specific pricing response has been verified. Static examples are not live quotes.
  async getLivePricing(): Promise<ProviderPriceRecord[]> {
    return [];
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
        estimatedStartupSeconds: 12,
        timestamp: new Date().toISOString(),
        source: "Lightning AI Studios",
      };
    }
    return {
      providerId: this.id,
      gpuModel: match.gpuModel,
      region: region || match.region,
      available: true,
      stockCount: null,
      currentPriceHourly: match.hourlyPrice,
      spotAvailable: match.isInterruptible,
      spotPriceHourly: match.spotPriceHourly,
      estimatedStartupSeconds: 12,
      timestamp: match.timestamp,
      source: match.source,
    };
  }

  async getInstanceTypes(): Promise<InstanceTypeInfo[]> {
    const prices = await this.getLivePricing();
    return prices.map((p) => ({
      id: p.id,
      providerId: this.id,
      name: `Lightning Studio (${p.gpuModel})`,
      gpuModel: p.gpuModel,
      gpuCount: p.gpuCount,
      vramGb: p.vramGb,
      vcpu: 8,
      ramGb: 32,
      defaultStorageGb: 100,
      hourlyPrice: p.hourlyPrice,
      isSpot: p.isInterruptible,
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
    if (!this.apiKey || !this.userId)
      throw new Error("LIGHTNING credentials not configured");
    try {
      const res = await this.safeFetch(
        `https://lightning.ai/api/v1/studios/${instanceId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "X-Lightning-User-Id": this.userId,
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
          data.status === "RUNNING"
            ? "RUNNING"
            : data.status === "STOPPED"
              ? "STOPPED"
              : "UNKNOWN",
        ipAddress: data.ip_address,
        uptimeSeconds: Math.round(Number(data.uptime_seconds || 0)),
        currentCostAccruedUsd: Number(data.current_cost_usd || 0),
        hourlyRateUsd: Number(data.cost_per_hour_usd || 0),
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
      "Lightning AI exposes telemetry in Web UI and SSH session",
    );
  }

  async submitWorkload(
    instanceId: string,
    workload: WorkloadSpec,
  ): Promise<WorkloadSubmissionResult> {
    return this.createUnavailableWorkload(
      workload.workloadId,
      "Lightning AI job execution requires active Studio/Job API runner; direct interactive submission is UNAVAILABLE",
    );
  }

  async retrieveOutput(
    instanceId: string,
    workloadId: string,
  ): Promise<WorkloadOutputResult> {
    return this.createUnavailableOutput(
      workloadId,
      "Lightning AI job artifact outputs must be retrieved via Studio storage; direct REST output API is UNAVAILABLE",
    );
  }

  async getUsage(instanceId: string): Promise<ProviderUsageResult> {
    const status = await this.getInstanceStatus(instanceId);
    return {
      providerId: this.id,
      instanceId,
      runtimeSeconds: status.uptimeSeconds,
      gpuHours: Number((status.uptimeSeconds / 3600).toFixed(4)),
      totalCostUsd: status.currentCostAccruedUsd,
      currency: "USD",
      isFinal: status.status === "TERMINATED",
      periodStartIso: new Date(
        Date.now() - status.uptimeSeconds * 1000,
      ).toISOString(),
      periodEndIso: new Date().toISOString(),
    };
  }

  async getBilling(): Promise<ProviderBillingResult> {
    if (!this.apiKey) {
      return {
        providerId: this.id,
        accountBalanceUsd: null,
        creditRemainingUsd: null,
        currentUnbilledChargesUsd: null,
        currency: "USD",
        billingMechanism: "POSTPAID_CARD",
        invoiceCount: 0,
      };
    }
    try {
      const res = await this.safeFetch("https://lightning.ai/v1/memberships", {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const body = await res.json();
        const bal =
          typeof body.memberships?.[0]?.balance === "number"
            ? Number(body.memberships[0].balance.toFixed(2))
            : 0;
        return {
          providerId: this.id,
          accountBalanceUsd: bal,
          creditRemainingUsd: bal,
          currentUnbilledChargesUsd: null,
          currency: "USD",
          billingMechanism: "PREPAID_CREDIT",
          invoiceCount: 1,
          rawBillingInfo: body.memberships?.[0],
        };
      }
    } catch {}
    return {
      providerId: this.id,
      accountBalanceUsd: null,
      creditRemainingUsd: null,
      currentUnbilledChargesUsd: null,
      currency: "USD",
      billingMechanism: "POSTPAID_CARD",
      invoiceCount: 0,
    };
  }
}
