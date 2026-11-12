import { strictPublicationTimestamp } from "../publicationTimestamp.js";
import { createHash } from "node:crypto";
import {
  readOfficial,
  type ReadTransport,
  type ReadRequest,
} from "./transport.js";
import type { Candidate, Offer } from "./model.js";
import { safePublicReference } from "../phase20/evidence.js";
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const list = (v: unknown): unknown[] => {
  if (!Array.isArray(v) || v.length > 1000)
    throw Error("SOURCE_SCHEMA_INVALID");
  return v.slice(0, 50);
};
const text = (v: unknown) => (typeof v === "string" ? v.slice(0, 300) : "");
const id = (v: unknown) => {
  const value =
    typeof v === "number" && Number.isSafeInteger(v) ? String(v) : text(v);
  if (!/^[A-Za-z0-9_.:-]{1,180}$/.test(value)) throw Error("SOURCE_ID_INVALID");
  return value;
};
const number = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
const digest = (data: unknown) =>
  createHash("sha256").update(JSON.stringify(data)).digest("hex");
export interface DiscoveryBatch {
  adapter: string;
  candidates: Candidate[];
  offers: Offer[];
  evidence: {
    sourceUrl: string;
    retrievedAt: string;
    responseDigest: string;
    notes: string;
  };
  truncated: boolean;
  financialExecutionAllowed: false;
}
abstract class Adapter {
  constructor(protected readonly transport: ReadTransport = readOfficial) {}
  protected async read(request: ReadRequest) {
    const response = await this.transport(request);
    const observed = Date.parse(response.retrievedAt);
    if (
      !Number.isFinite(observed) ||
      observed > Date.now() ||
      Date.now() - observed > 60000
    )
      throw Error("SOURCE_TIME_INVALID");
    return response;
  }
  protected batch(
    adapter: string,
    response: Awaited<ReturnType<ReadTransport>>,
    notes: string,
  ): DiscoveryBatch {
    return {
      adapter,
      candidates: [],
      offers: [],
      evidence: {
        sourceUrl: response.sourceUrl,
        retrievedAt: response.retrievedAt,
        responseDigest: digest(response.data),
        notes,
      },
      truncated: true,
      financialExecutionAllowed: false,
    };
  }
}
export class AkashDiscoveryAdapter extends Adapter {
  async discover() {
    const response = await this.read({ operation: "akashOrders" });
    let deployments: Awaited<ReturnType<ReadTransport>>;
    try {
      deployments = await this.read({ operation: "akashDeployments" });
    } catch (error) {
      // Both versions are documented by the official chain SDK. Only an unsupported-service response permits compatibility fallback.
      if (!(error instanceof Error) || error.message !== "SOURCE_HTTP_501")
        throw error;
      deployments = await this.read({ operation: "akashDeploymentsV1Beta4" });
    }
    // Validate both interfaces; escrow deposit is neither an award nor a fixed-duration funding guarantee.
    list(object(deployments.data).deployments);
    const batch = this.batch(
      "akash",
      response,
      "Open chain orders only. Deployment/escrow, per-block pricing, duration, SDL, provider registration and award require independent review. Deployment source: " +
        deployments.sourceUrl +
        ". Deployment response digest: " +
        digest(deployments.data),
    );
    for (const row of list(object(response.data).orders)) {
      const order = object(object(row).order || row),
        orderId = object(order.id);
      if (order.state !== "open") continue;
      const resources = list(object(order.spec).resources);
      const discoveredRequirements = resources.flatMap((row) => {
        const unit = object(row),
          gpu = object(object(unit.resource).gpu),
          units = object(gpu.units);
        const value = String(units.val ?? "");
        if (
          !/^[1-9][0-9]{0,3}$/.test(value) ||
          !Number.isSafeInteger(unit.count) ||
          Number(unit.count) < 1
        )
          return [];
        const price = object(unit.price);
        return [
          {
            gpuUnits: Number(value),
            replicas: Number(unit.count),
            pricePerBlock:
              typeof price.amount === "string" &&
              /^[0-9]+(?:\.[0-9]+)?$/.test(price.amount)
                ? price.amount
                : null,
            currencyDenom:
              typeof price.denom === "string" &&
              /^[A-Za-z0-9/]{1,128}$/.test(price.denom)
                ? price.denom
                : null,
          },
        ];
      });
      if (!discoveredRequirements.length) continue;
      const key = [orderId.owner, orderId.dseq, orderId.gseq, orderId.oseq]
        .map(id)
        .join(":");
      batch.candidates.push({
        id: "akash:" + key,
        source: "akash",
        sourceUrl: response.sourceUrl,
        retrievedAt: response.retrievedAt,
        expiresAt: new Date(
          Date.parse(response.retrievedAt) + 60000,
        ).toISOString(),
        evidenceDigest: batch.evidence.responseDigest,
        title: "Akash open GPU order " + key,
        discoveredRequirements,
        funding: "UNVERIFIED",
      });
    }
    return batch;
  }
}
export class EnterpriseRfqAdapter extends Adapter {
  async discover(credential: string, postedFrom: string, postedTo: string) {
    const response = await this.read({
      operation: "enterpriseRfqs",
      credential,
      postedFrom,
      postedTo,
    });
    const batch = this.batch(
      "enterprise",
      response,
      "SAM.gov notices are procurement leads, not secured contracts or verified funds. Review full requirements, set-asides, registration and subcontracting permission.",
    );
    for (const row of list(object(response.data).opportunitiesData)) {
      const record = object(row);
      if (record.active !== "Yes") continue;
      const notice = id(record.noticeId),
        link = "https://sam.gov/opp/" + encodeURIComponent(notice) + "/view";
      const deadline = strictPublicationTimestamp(
        text(record.responseDeadLine),
        true,
      );
      // SAM active means not archived, not necessarily open for responses. Ambiguous/missing deadlines fail closed per notice.
      if (
        !Number.isFinite(deadline) ||
        deadline <= Math.max(Date.now(), Date.parse(response.retrievedAt))
      )
        continue;
      batch.candidates.push({
        id: "sam:" + notice,
        source: "enterprise",
        sourceUrl: link,
        retrievedAt: response.retrievedAt,
        expiresAt: new Date(
          Math.min(
            Date.parse(response.retrievedAt) + 3600000,
            Number.isFinite(deadline)
              ? deadline
              : Date.parse(response.retrievedAt) + 3600000,
          ),
        ).toISOString(),
        evidenceDigest: batch.evidence.responseDigest,
        title: text(record.title),
        funding: "UNVERIFIED",
      });
    }
    return batch;
  }
}
export class VastWholesaleAdapter extends Adapter {
  async discover(credential: string) {
    const response = await this.read({ operation: "vastOffers", credential }),
      batch = this.batch(
        "vast",
        response,
        "Observed offers expire locally in 60 seconds; availability is not reserved. Prices exclude unverified ancillary costs and do not prove resale permission.",
      );
    for (const row of list(object(response.data).offers)) {
      const offer = object(row),
        hourly = number(offer.dph_total),
        count = number(offer.num_gpus);
      if (
        offer.rentable !== true ||
        offer.rented !== false ||
        !hourly ||
        !count ||
        !Number.isInteger(count)
      )
        continue;
      batch.offers.push({
        id: "vast:" + id(offer.id),
        provider: "vast",
        sourceUrl: response.sourceUrl,
        retrievedAt: response.retrievedAt,
        expiresAt: new Date(
          Date.parse(response.retrievedAt) + 60000,
        ).toISOString(),
        evidenceDigest: batch.evidence.responseDigest,
        model: text(offer.gpu_name),
        gpuCount: count,
        hourlyUsd: hourly,
        availability: "OBSERVED",
        vramGb: null,
        bandwidthMbps: null,
        region: null,
        uptimeBps: null,
      });
    }
    return batch;
  }
}
export class RunpodWholesaleAdapter extends Adapter {
  async discover(credential?: string) {
    const response = await this.read({
        operation: "runpodCatalog",
        credential,
      }),
      batch = this.batch(
        "runpod",
        response,
        "Catalog minimum prices and stock indications only; region, fixed-duration availability, uptime and final all-in price remain unverified.",
      );
    if (object(response.data).errors) throw Error("SOURCE_GRAPHQL_REJECTED");
    for (const row of list(object(object(response.data).data).gpuTypes)) {
      const gpu = object(row),
        price = object(gpu.lowestPrice),
        hourly = number(price.uninterruptablePrice);
      if (!hourly) continue;
      batch.offers.push({
        id: "runpod:" + digest({ gpuId: text(gpu.id) }).slice(0, 32),
        provider: "runpod",
        sourceUrl: response.sourceUrl,
        retrievedAt: response.retrievedAt,
        expiresAt: new Date(
          Date.parse(response.retrievedAt) + 60000,
        ).toISOString(),
        evidenceDigest: batch.evidence.responseDigest,
        model: text(gpu.displayName),
        gpuCount: 1,
        hourlyUsd: hourly,
        availability: "CATALOG_ONLY",
        vramGb: number(gpu.memoryInGb),
        bandwidthMbps: null,
        region: null,
        uptimeBps: null,
      });
    }
    return batch;
  }
}
/** Disabled by policy until an official demand interface and operator-specific eligibility are reviewed. */
export const restrictedNetworks = [
  {
    network: "io.net",
    status: "BLOCKED",
    reason: "No reviewed secured-order interface or rental/resale eligibility.",
    sourceUrl: "https://docs.io.net/",
  },
  {
    network: "Nosana",
    status: "BLOCKED",
    reason:
      "Host registration, supported native Linux GPU, wallet and job assignment required. Queue activity does not secure a job.",
    sourceUrl: "https://learn.nosana.com/hosts/grid.html",
  },
  {
    network: "Render Network",
    status: "BLOCKED",
    reason:
      "Operator onboarding and workload assignment require approval; no reviewed secured-order interface.",
    sourceUrl: "https://rendernetwork.com/participate-node-operators",
  },
  {
    network: "Bittensor",
    status: "BLOCKED",
    reason:
      "Subnet-specific registration and competitive emissions do not constitute guaranteed contract revenue.",
    sourceUrl: "https://guides.learnbittensor.org/miners",
  },
] as const;
export function validateBatch(batch: DiscoveryBatch, now = Date.now()) {
  if (
    !safePublicReference(batch.evidence.sourceUrl) ||
    !batch.evidence.responseDigest.match(/^[a-f0-9]{64}$/)
  )
    throw Error("INVALID_SOURCE_EVIDENCE");
  for (const item of [...batch.candidates, ...batch.offers])
    if (
      !safePublicReference(item.sourceUrl) ||
      !Number.isFinite(Date.parse(item.expiresAt)) ||
      Date.parse(item.expiresAt) <= now ||
      Date.parse(item.retrievedAt) > now ||
      now - Date.parse(item.retrievedAt) > 3600000
    )
      throw Error("STALE_SOURCE_EVIDENCE");
  return batch;
}
