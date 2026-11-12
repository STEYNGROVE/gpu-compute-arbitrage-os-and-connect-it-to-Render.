import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  readOfficial,
  type ReadOperation,
  type ReadTransport,
} from "../server/prefunded/transport.js";
import { RunpodWholesaleAdapter } from "../server/prefunded/adapters.js";

const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
interface PublicProbeResult {
  operation: ReadOperation;
  status: "READ_SUCCEEDED" | "BLOCKED";
  sourceUrl?: string;
  retrievedAt?: string;
  responseDigest?: string;
  error?: string;
  note?: string;
  normalizedOffers?: number;
  mappingVerifiedAgainstResponse?: boolean;
  samples?: {
    id: string;
    model: string;
    vramGb?: number | null;
    hourlyUsd: number;
    availability: string;
    expiresAt: string;
  }[];
  observedRecords?: number;
  openGpuOrdersUnverified?: number;
  orderSamples?: { id: string; funding: string }[];
}
/** Explicit operator diagnostic. No credentials, fixtures, private endpoints, fallback prices or financial actions. */
export async function probePrefundedPublic(
  transport: ReadTransport = readOfficial,
) {
  const results = await Promise.all(
    (
      [
        "runpodCatalog",
        "akashOrders",
        "akashDeployments",
        "akashDeploymentsV1Beta4",
      ] as ReadOperation[]
    ).map(async (operation): Promise<PublicProbeResult> => {
      try {
        const response = await transport({ operation });
        const base = {
          operation,
          status: "READ_SUCCEEDED" as const,
          sourceUrl: response.sourceUrl,
          retrievedAt: response.retrievedAt,
          responseDigest: hash(response.data),
        };
        if (operation !== "runpodCatalog") {
          const key = operation === "akashOrders" ? "orders" : "deployments";
          const records = (response.data as Record<string, unknown>)?.[key];
          if (!Array.isArray(records) || records.length > 1000)
            throw Error("SOURCE_SCHEMA_INVALID");
          const gpuOrders =
            operation === "akashOrders"
              ? records.filter(
                  (row) =>
                    row?.state === "open" &&
                    Array.isArray(row?.spec?.resources) &&
                    row.spec.resources.some((unit) =>
                      /^[1-9][0-9]{0,3}$/.test(
                        String(unit?.resource?.gpu?.units?.val ?? ""),
                      ),
                    ),
                )
              : [];
          return {
            ...base,
            observedRecords: records.length,
            openGpuOrdersUnverified: gpuOrders.length,
            orderSamples: gpuOrders.slice(0, 3).map((row) => ({
              id: ["owner", "dseq", "gseq", "oseq"]
                .map((key) => String(row.id?.[key] ?? "").slice(0, 180))
                .join(":"),
              funding: "UNVERIFIED",
            })),
            note: "Read access alone does not establish chain freshness, escrow funding, provider eligibility or award.",
          };
        }
        // Normalize the exact response that was retrieved, then verify every normalized row against it.
        const batch = await new RunpodWholesaleAdapter(async (request) => {
          if (request.operation !== operation)
            throw Error("UNEXPECTED_OPERATION");
          return response;
        }).discover();
        const rows = (
          response.data as { data: { gpuTypes: Record<string, any>[] } }
        ).data.gpuTypes;
        for (const offer of batch.offers) {
          const raw = rows.find(
            (row) =>
              "runpod:" +
                hash({
                  gpuId: typeof row.id === "string" ? row.id.slice(0, 300) : "",
                }).slice(0, 32) ===
              offer.id,
          );
          if (
            !raw ||
            offer.hourlyUsd !== raw.lowestPrice?.uninterruptablePrice ||
            offer.model !== raw.displayName?.slice(0, 300)
          )
            throw Error("SUPPLIER_MAPPING_MISMATCH");
        }
        return {
          ...base,
          normalizedOffers: batch.offers.length,
          mappingVerifiedAgainstResponse: true,
          samples: batch.offers.slice(0, 3).map((offer) => ({
            id: offer.id,
            model: offer.model,
            vramGb: offer.vramGb,
            hourlyUsd: offer.hourlyUsd,
            availability: offer.availability,
            expiresAt: offer.expiresAt,
          })),
          note: "Public supplier catalog only. No reserved capacity, customer demand, firm all-in quote, funding or profit verified.",
        };
      } catch (error) {
        const code =
          error instanceof Error && /^[A-Z_0-9]+$/.test(error.message)
            ? error.message
            : "SOURCE_READ_FAILED";
        return { operation, status: "BLOCKED", error: code };
      }
    }),
  );
  return {
    checkedAt: new Date().toISOString(),
    origin:
      transport === readOfficial ? "LIVE_PUBLIC_HTTPS" : "OFFLINE_INJECTED",
    financialExecutionAllowed: false,
    fundedCustomerOpportunitiesVerified: 0,
    escrowFundingVerification: "NOT_IMPLEMENTED_NO_TRUSTED_COLLECTOR",
    realizedRevenueVerified: false,
    results,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  probePrefundedPublic()
    .then((report) =>
      process.stdout.write(JSON.stringify(report, null, 2) + "\n"),
    )
    .catch(() => {
      process.stderr.write("PUBLIC_PROBE_FAILED\n");
      process.exitCode = 1;
    });
}
